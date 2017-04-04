var bCrypt = require('bcryptjs');
var file = appRoot + "/bin/sqlite/db/local.db";
var sqlite3 = require("sqlite3").verbose();
var fs = require("fs");
var logger = require(appRoot + "/app").logger;

var Sqlite = function(){
    var exists = fs.existsSync(file);
    var db = new sqlite3.Database(file);
    this.db = db;
    this.db.serialize(function() {
        if(!exists) {
            db.run("CREATE TABLE API (id integer primary key," +
                "clientId VARCHAR(30)," +
                "ownerId INTEGER," +
                "vhmId VARCHAR(15), " +
                "vpcUrl VARCHAR(60), "+
                "accessToken VARCHAR(60)," +
                "refreshToken VARCHAR(60)," +
                "expireAt DATETIME," +
                "SchoolId INTEGER)");
            db.run("CREATE TABLE User (id integer primary key, " +
                "firstName VARCHAR(30), " +
                "lastName VARCHAR(30), " +
                "email VARCHAR(60), " +
                "username VARCHAR(60) NOT NULL UNIQUE, " +
                "password VARCHAR(120) NOT NULL, " +
                "userEnable BOOL, " +
                "lastLogin DATETIME, " +
                "LanguageId INTEGER, " +
                "SchoolId INTEGER, " +
                "GroupId INTEGER NOT NULL)");
            db.run("CREATE TABLE UserGroup (id integer primary key," +
                "groupName VARCHAR(30))");
            db.run("CREATE TABLE Device (id integer primary key," +
                "ownerId INTEGER, " +
                "macAddress VARCHAR(16), " +
                "hostname VARCHAR(60), " +
                "serialId VARCHAR(14) NOT NULL UNIQUE, " +
                "model VARCHAR(10), " +
                "ip VARCHAR(12), " +
                "simType VARCHAR(10), " +
                "locations VARCHAR(60)," +
                "SchoolId INTEGER, " +
                "connected BOOL, " +
                "ApiId INTEGER)");
            db.run("CREATE TABLE Classroom (id integer primary key," +
                "classroomName VARCHAR(30), " +
                "DeviceId INTEGER," +
                "SchoolId INTEGER)");
            db.run("CREATE TABLE Lesson (id integer primary key," +
                "startDate DATETIME," +
                "endDate DATETIME," +
                "ClassroomId INTEGER," +
                "UserId INTEGER," +
                "SchoolId INTEGER, " +
                "startDone BOOL NOT NULL DEFAULT FALSE," +
                "endDone BOOL NOT NULL DEFAULT FALSE)");
            db.run("CREATE TABLE UILanguage (id integer primary key," +
                "language VARCHAR(20)," +
                "code VARCHAR(6))");
            db.run('CREATE TABLE School (id integer primary key,' +
                'schoolName VARCHAR(32), ' +
                'accessMethod VARCHAR(3), ' +
                'sshAdmin VARCHAR(32), ' +
                'sshPassword VARCHAR(64))');
            db.run("INSERT INTO User VALUES (1, '', '', '', 'admin', '"+createHash("aerohive")+"', 'true', '', 1, 1, 1)");
            db.run("INSERT INTO UserGroup VALUES (1, 'Administrator')");
            db.run("INSERT INTO UserGroup VALUES (2, 'Operator')");
            db.run("INSERT INTO UserGroup VALUES (3, 'Teacher')");
            db.run("INSERT INTO UserGroup VALUES (4, 'Monitor')");
            db.run("INSERT INTO School VALUES (1, 'None', '', '', '')");
            db.run("INSERT INTO UILanguage VALUES (1, 'English', 'en')");
            db.run("INSERT INTO UILanguage VALUES (2, 'Francais', 'fr')");
        }
    });
};

Sqlite.prototype.customSelect = function(table, filter_string, callback){
    logger.debug('SELECT * FROM ' + table + " WHERE " + filter_string);
    this.db.all('SELECT * FROM ' + table + " WHERE " + filter_string, function(err, ret){
        if (err){
            logger.error(err);
        }
        callback(err, ret);
    });
};

Sqlite.prototype.customJoin = function(fields, table1, table2, table1JoinId, table2JoinId, filterString, callback){
    if (fields == null) {
        fields = "*";
    }
    var queryString = 'SELECT ' + fields+ ' FROM ' + table1 + " INNER JOIN " + table2 +
        " ON " + table1JoinId + " = " + table2JoinId +
        " WHERE " + filterString;
    logger.debug(queryString);
    this.db.all(queryString, function(err, ret){
        if (err){
            logger.error(err);
        }
        callback(err, ret);
    });
};

Sqlite.prototype.updateDB = function(table, rowId, entries, callback){
    var updateString = "";
    var fieldNumber = 0;
    for (var entry in entries) {
        if (entry == 'password' || entry == "sshPassword") {
            if (entries[entry] != "") {
                if (fieldNumber != 0) {
                    updateString += ",  ";
                }
                if (entry == 'sshPassword'){
                    updateString += entry + "='" + entries[entry] + "'";
                } else {
                    updateString += entry + "='" + createHash(entries[entry]) + "'";
                }
                fieldNumber++;
            }
        } else {
            if (fieldNumber != 0) {
                updateString += ",  ";
            }
            updateString += entry + "='" + entries[entry] + "'";
            fieldNumber++;
        }
    }
    updateString = 'UPDATE ' + table + ' SET ' + updateString + ' WHERE id=' + rowId + ";" ;
    logger.debug(updateString);
    this.db.run(updateString, function(err){
        if (err){
            logger.error(err);
        }
        callback(err);
    })
};

Sqlite.prototype.insertDB = function(table, rows, callback){
    var insertFields = "";
    var insertValues = "";
    var fieldNumber = 0;
    for (var field in rows) {
        if (fieldNumber != 0) {
            insertFields += ",  ";
            insertValues += ",  ";
        }
        if (field == 'password') {
            if (rows[field] != "") {
                insertFields += field;
                insertValues += "'" + createHash(rows[field]) + "'";
                fieldNumber++;
            }
        } else {
            insertFields += field;
            insertValues += '"' + rows[field] + '"';
            fieldNumber++;
        }
    }
    var insertString = 'INSERT INTO ' + table + ' (' + insertFields + ') VALUES (' + insertValues + ");" ;
    logger.debug(insertString);
    this.db.run(insertString, function(err){
        if (err){
            logger.error(err);
        }
        callback(err, this.lastID);
    });
};

processOptions = function(rOptions){
    var options = rOptions || {};
    var columnsString = "";
    var orderByString = "";
    var optionNumber = 0;
    if (options.columns){
        optionNumber = 0;
        for (var column in options['columns']){
            if (optionNumber != 0){
                columnsString += ", ";
            }
            columnsString += options['columns'][column];
            optionNumber++;
        }
    } else {
        columnsString = "*";
    }
    if (options.orderBy){
        orderByString = " ORDER BY " + options['orderBy'];
    } else {
        orderByString = "";
    }
    return { "columns": columnsString, "orderBy": orderByString};
};

processFilters = function(filters){
    var filterString = "";
    if (filters != null) {
        var filterNum = 0;
        for (var filterName in filters){
            if (filterNum != 0) filterString += " AND ";
            if (typeof filters[filterName] != "object") filterString += filterName + "='" + filters[filterName] +"'";
            else filterString += filterName + filters[filterName][0] + filters[filterName][1];
            filterNum ++;
        }
        filterString = " WHERE (" + filterString + ")";
    }
    return filterString;
};

Sqlite.prototype.findOne = function(table, filters, options, callback){
    /**
     Find the first row matching the fields
     Table: Table to request
     Fields: object {fieldName: fieldValue}
     Options: object {option: []} with the following options (optionals)
        columns: columns to retrieve
        orderBy: how to sort the result
     */
    var filterString = processFilters(filters);
    var rOptions = processOptions(options);
    var selectString = "SELECT " + rOptions.columns + " FROM " + table + filterString;
    logger.debug(selectString);
    this.db.get(selectString, function(err, ret){
        if (err){
            logger.error(err);
        }
        callback(err, ret);
    });
};

Sqlite.prototype.findAll = function(table, filters, options, callback){
    /**
     Find the rows matching the fields
     Table: Table to request
     Fields: object {fieldName: fieldValue}
     Options: object {option: []} with the following options (optionals)
     columns: columns to retrieve
     orderBy: how to sort the result
     */
    var filterString = processFilters(filters);
    var rOptions = processOptions(options);
    var selectString = "SELECT " + rOptions.columns + " FROM " + table + filterString;
    logger.debug(selectString);
    this.db.all(selectString, function(err, ret){
        if (err){
            logger.error(err);
        }
        callback(err, ret);
    });
};

Sqlite.prototype.findById = function(table, rowId, filters, options, callback){
    /**
     Get one row by its ID
     Table: Table to request
     Options: object {option: []} with the following options (optionals)
         columns: columns to retrieve
         orderBy: how to sort the result
     */
    if (rowId >= 0){
        var rOptions = processOptions(options);
        filters = filters || {};
        filters['id'] = rowId;
        var filterString = processFilters(filters);
        var getString = "SELECT " + rOptions.columns + " FROM " + table + filterString;
        logger.debug("FindById: " +getString);
        this.db.get(getString, function(err, ret){
            if (err){
                logger.error(err);
            }
            callback(err, ret);
        });
    } else {
        callback(null, null);
    }

};


Sqlite.prototype.deleteById = function (table, rId, callback){
    this.db.run("DELETE FROM " + table + " WHERE id = "+rId, function(err, ret){
        if (err){
            logger.error(err);
        }
        callback(err, ret);
    });
};

isValidPassword = function(user, password){
    return bCrypt.compareSync(password, user.password);
};

createHash = function(password){
    return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
};

module.exports = Sqlite;
module.exports.isValidPassword = isValidPassword;
module.exports.createHash = createHash;
