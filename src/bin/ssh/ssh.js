var Client = require('ssh2').Client;
var EventEmitter = require('events').EventEmitter;


function connect(host, port, username, password, sshEvent) {
    var conn = new Client();
    conn.on('ready', function () {
        console.info("\x1b[32minfo\x1b[0m:",'SSH >> Client :: ready :: ' + host);
        conn.shell(function (err, stream) {
            if (err) {
                conn.end();
                sshEvent.emit("error", err);
            }
            stream.on('close', function (code, signal) {
                console.info("\x1b[32minfo\x1b[0m:",'SSH >> Stream :: close :: code: ' + code + ', signal: ' + signal);
                conn.end();
                sshEvent.emit("end");
            }).on('data', function (data) {
                sshEvent.emit("data", data.toString(), stream);
            }).stderr.on('data', function (data) {
                    console.info("\x1b[32minfo\x1b[0m:",'SSH >> STDERR: ' + data);
                });
        });
    }).on('error', function(err) {
        sshEvent.emit("error", err);
    }).connect({
        host: host,
        port: port,
        username: username,
        password: password
    });
    return conn;

}

function parseSSID(data) {
    var entries = data.split('\n');
    var ssid = "";
    var ssidList = [];
    for (var entry in entries) {
        var entryString = entries[entry];
        if (entryString.indexOf('ssid') == 0) {
            entryString = entryString.replace("ssid ", "");
            if (entryString.indexOf('"') == 0) {
                ssid = '"' + entryString.split('"')[1].replace('\n', "").replace("\r", "") + '"';
            } else {
                ssid = entryString.split(' ')[0].replace('\n', "").replace("\r", "");
            }
            if (ssidList.indexOf(ssid) < 0) {
                ssidList.push(ssid);
            }
        }
    }
    return ssidList;
}


module.exports.execute = function (deviceIP, commands, login, password, callback) {
    var sshEvent = new EventEmitter();
    connect(deviceIP, 22, login, password, sshEvent);
    var commandReady = -1;
    var commandData = -1;
    sshEvent.on("ready", function (stream) {
        if (commandReady < 0) {
            console.info("\x1b[32minfo\x1b[0m:","SSH >> READY -- init -- console page 0");
            stream.write("console page 0\n");
            commandReady = 0;
        } else if (0 <= commandReady && commandReady < commands.length) {
            console.info("\x1b[32minfo\x1b[0m:","SSH >> READY -- command " + commandReady + " -- " + commands[commandReady]);
            if (commands[commandReady] == "enableWiFi") {
                stream.write("show running-config | include ssid\n");
            } else if (commands[commandReady] == "disableWiFi") {
                stream.write("show running-config | include ssid\n");
            }
            commandData = commandReady;
        }
    }).on("exit", function(stream){
        console.info("\x1b[32minfo\x1b[0m:","SSH >> READY -- EXIT -- console page 22");
        stream.write("console page 22\n");
        console.info("\x1b[32minfo\x1b[0m:","SSH >> READY -- EXIT");
        stream.write("exit\n");
    }).on("data", function (data, stream) {
        if (data.indexOf("#") == (data.length - 1)) {

            if (0 <= commandData && commandData < commands.length) {
                if (commands[commandData] == "enableWiFi") {
                    console.info("\x1b[32minfo\x1b[0m:","SSH >> event 'data' > " + commands[commandData]);
                    var ssidList = parseSSID(data);
                    var commandString = "";
                    for (var ssid in ssidList) {
                        commandString += "interface wifi0 ssid " + ssidList[ssid] + "\n";
                        commandString += "interface wifi1 ssid " + ssidList[ssid] + "\n";
                    }
                    commandString += "no system led power-saving-mode\n";
                    commandString += "system led brightness bright\n";
                    commandReady++;
                    commandData = -1;
                    stream.write(commandString, function(){
                        sshEvent.emit("exit", stream);
                    });
                } else if (commands[commandData] == "disableWiFi") {
                    console.info("\x1b[32minfo\x1b[0m:","SSH >> event 'data' > " + commands[commandData]);
                    var ssidList = parseSSID(data);
                    var commandString = "";
                    for (var ssid in ssidList) {
                        commandString += "no interface wifi0 ssid " + ssidList[ssid] + "\n";
                        commandString += "no interface wifi1 ssid " + ssidList[ssid] + "\n";
                    }
                    commandString += "system led power-saving-mode on 4 off 64\n";
                    commandString += "system led brightness off\n";
                    commandReady++;
                    commandData = -1;
                    stream.write(commandString, function(){
                        sshEvent.emit("exit", stream);
                    });
                }
            } else {
                 if (data.indexOf("--More--") > 0) {
                    stream.write(" ");
                } else {
                    sshEvent.emit("ready", stream);
                }
            }
        } else if (data.indexOf("(Y/N)") == (data.length - 5)) {
            stream.write("Y\n");
        }
    }).on('end', function(){
        callback(null);
    }).on('error', function(err){
        callback(err);
    })
};