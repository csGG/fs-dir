const fs = require("fs");
const path = require("path");
const {
    mkdir,
    mkdirSync
} = require("./mkdir");

const DEFAULT_OPTIONS = {
    replace: true
};

function parseDest(src, dest) {
    let dir, fileName;
    dest = path.normalize(dest);
    //if dest ends with slash, regard as directory
    if (dest.endsWith(path.sep)) {
        dir = dest;
        fileName = path.parse(src).base;
    } else {
        let tmp = path.parse(dest);
        dir = tmp.dir;
        fileName = tmp.base;
    }
    fileName = path.join(dir, fileName);
    return {
        dir,
        fileName
    }
}

function copyFile(src, dest, options, callback) {
    let {
        dir,
        fileName
    } = parseDest(src, dest);
    options.mkdir = true;
    options.dir = dir;
    _copyFile(src, fileName, options, callback);
}

function _copyFile(src, dest, options, callback) {

    let copy = fs.copyFile || function copy(src, dest, callback) {
        let rs = fs.createReadStream(src);
        let ws = fs.createWriteStream(dest);
        rs.pipe(ws);
        rs.once("end", callback);
    }

    fs.access(dest, err => {
        if (err || options.replace) {
            if (options.mkdir) {
                mkdir(options.dir, err => {
                    if (err) return callback(err);
                    copy(src, dest, callback);
                });
            } else {
                copy(src, dest, callback);
            }
            return;
        }
        callback();
    });
}

function forEach(files, dir, dest, options, fn, callback) {
    for (let file of files) {
        let fileName = path.join(dir, file);
        let destFile = path.join(dest, file);
        fs.lstat(fileName, (err, stat) => {
            if (err) return callback(err);
            if (stat.isDirectory()) {
                mkdir(destFile, err => {
                    if (err && err.code !== "EEXIST") return callback(err);
                    fn(fileName, destFile, callback);
                });
            } else {
                options.mkdir = false;
                _copyFile(fileName, destFile, options, callback);
            }
        });
    }
}

function copyDir(src, dest, options, callback) {
    let fileNum = 1; //src
    let cb = function (err) {
        if (err) {
            return callback(err);
        }
        if (--fileNum === 0) {
            callback();
        }
    }

    function readdir(dir, dest, callback) {
        fs.readdir(dir, (err, files) => {
            if (err) return callback(err);
            fileNum--; //directory
            fileNum += files.length;
            if (!fileNum) {
                callback();
                return;
            }
            forEach(files, dir, dest, options, readdir, callback);
        });
    }
    mkdir(dest, {
        recursive: true
    }, err => {
        if (err && err.code !== "EEXIST") return cb(err);
        readdir(src, dest, cb);
    });
}

function handleDefault(src, dest, options, callback) {
    if (typeof src !== "string") {
        throw new Error('The "src" argument must be of type string');
    }
    if (typeof dest !== "string") {
        throw new Error('The "src" argument must be of type string');
    }
    if (!options) {
        options = Object.assign({}, DEFAULT_OPTIONS);
    } else if (typeof options === "function") {
        callback = options;
        options = Object.assign({}, DEFAULT_OPTIONS);
    } else {
        options = Object.assign({}, DEFAULT_OPTIONS, options);
    }
    return {
        callback,
        options
    }
}

function cp(src, dest) {
    let {
        callback,
        options
    } = handleDefault.apply(null, arguments);
    if (typeof callback !== "function") {
        throw new Error("callback function required");
    }
    fs.lstat(src, (err, stat) => {
        if (err) {
            return callback(err);
        }
        if (stat.isFile()) {
            copyFile(src, dest, options, callback);
        } else if (stat.isDirectory()) {
            copyDir(src, dest, options, callback);
        }
    });
}

function copyFileSync(src, dest, options) {
    let {
        dir,
        fileName
    } = parseDest(src, dest);
    if (fs.existsSync(fileName)) {
        if (!options.replace) return;
    } else {
        try {
            mkdirSync(dir, {
                recursive: true
            });
        } catch (error) {}
    }
    if (fs.copyFileSync) {
        return fs.copyFileSync(src, dest);
    }
    let stat = fs.lstatSync(src);
    let rFd = fs.openSync(src, "r");
    let wFd = fs.openSync(fileName, "w");
    let pos = 0;
    const READ_SIZE = 1024 * 1024; //default 1MB
    let buffer = Buffer.allocUnsafe(READ_SIZE);
    while (pos < stat.size) {
        let bytesRead = fs.readSync(rFd, buffer, 0, READ_SIZE, pos);
        fs.writeSync(wFd, buffer, 0, bytesRead);
        pos += bytesRead;
    }
    fs.closeSync(rFd);
    fs.closeSync(wFd);
}

function copyDirSync(src, dest, options) {
    mkdirSync(dest, {
        recursive: true
    });
    let files = fs.readdirSync(src);
    for (let file of files) {
        let fileName = `${src}/${file}`;
        let stat = fs.lstatSync(fileName);
        let _dest = `${dest}/${file}`;
        if (stat.isDirectory()) {
            mkdirSync(fileName);
            copyDirSync(fileName, _dest, options);
        } else {
            copyFileSync(fileName, _dest, options);
        }
    }
}

function cpSync(src, dest) {
    let {
        options
    } = handleDefault.apply(null, arguments);
    let stat = fs.lstatSync(src);
    if (stat.isFile()) {
        copyFileSync(src, dest, options);
    } else if (stat.isDirectory()) {
        copyDirSync(src, dest, options);
    }
}

module.exports = {
    cp,
    cpSync
};