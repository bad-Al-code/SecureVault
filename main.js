#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var crypto = require("node:crypto");
var fs = require("node:fs/promises");
var os = require("node:os");
var path = require("node:path");
var node_child_process_1 = require("node:child_process");
var VaultCLI = /** @class */ (function () {
    function VaultCLI() {
    }
    VaultCLI.getPassword = function () {
        return __awaiter(this, arguments, void 0, function (confirm) {
            var stdin, stdout, question, password, confirmPassword;
            if (confirm === void 0) { confirm = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        stdin = process.stdin;
                        stdout = process.stdout;
                        question = function (prompt) {
                            return new Promise(function (resolve) {
                                var password = '';
                                stdout.write(prompt);
                                stdin.setRawMode(true);
                                stdin.resume();
                                stdin.setEncoding('utf8');
                                var onData = function (char) {
                                    if (char === '\u0003') {
                                        // Ctrl+C
                                        stdout.write('\n');
                                        process.exit(1);
                                    }
                                    else if (char === '\b' || char === '\x7f') {
                                        // Backspace Key
                                        if (password.length > 0) {
                                            password = password.slice(0, -1);
                                            stdout.write('\b \b');
                                        }
                                    }
                                    else if (char === '\r' || char === '\n') {
                                        // Enter Key
                                        stdout.write('\n');
                                        stdin.setRawMode(false);
                                        stdin.pause();
                                        stdin.removeListener('data', onData);
                                        resolve(password);
                                    }
                                    else {
                                        password += char;
                                        stdout.write('*');
                                    }
                                };
                                stdin.on('data', onData);
                            });
                        };
                        return [4 /*yield*/, question('New Vault password: ')];
                    case 1:
                        password = _a.sent();
                        if (!confirm) return [3 /*break*/, 3];
                        return [4 /*yield*/, question('Confirm New Vault password: ')];
                    case 2:
                        confirmPassword = _a.sent();
                        if (password !== confirmPassword) {
                            console.error('Error: Passwords do not match');
                            process.exit(1);
                        }
                        _a.label = 3;
                    case 3: return [2 /*return*/, password];
                }
            });
        });
    };
    VaultCLI.deriveKey = function (password, salt) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        crypto.pbkdf2(password, salt, _this.ITERATIONS, _this.KEY_LENGTH, 'sha256', function (err, derivedKey) {
                            if (err)
                                reject(err);
                            else
                                resolve(derivedKey);
                        });
                    })];
            });
        });
    };
    VaultCLI.encryptFile = function (filename) {
        return __awaiter(this, void 0, void 0, function () {
            var data, password, salt, iv, key, cipher, encrypted, output, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, fs.readFile(filename, 'utf8')];
                    case 1:
                        data = _a.sent();
                        return [4 /*yield*/, this.getPassword(true)];
                    case 2:
                        password = _a.sent();
                        salt = crypto.randomBytes(this.SALT_SIZE);
                        iv = crypto.randomBytes(16);
                        return [4 /*yield*/, this.deriveKey(password, salt)];
                    case 3:
                        key = _a.sent();
                        cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
                        encrypted = cipher.update(data, 'utf8', 'hex');
                        encrypted += cipher.final('hex');
                        output = [
                            this.HEADER.trim(),
                            salt.toString('hex'),
                            iv.toString('hex'),
                            encrypted,
                        ].join('\n');
                        console.log('Writing encrypted content to file...');
                        return [4 /*yield*/, fs.writeFile(filename, output)];
                    case 4:
                        _a.sent();
                        console.log('Encryption successful. File updated.');
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        console.error('Encryption failed:', error_1.message);
                        process.exit(1);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    VaultCLI.decryptFile = function (filename) {
        return __awaiter(this, void 0, void 0, function () {
            var encryptedData, lines, password, salt, iv, encrypted, key, decipher, decrypted, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, fs.readFile(filename, 'utf8')];
                    case 1:
                        encryptedData = _a.sent();
                        lines = encryptedData.split('\n');
                        if (lines[0] !== this.HEADER.trim()) {
                            throw new Error('Invalid vault format');
                        }
                        return [4 /*yield*/, this.getPassword()];
                    case 2:
                        password = _a.sent();
                        salt = Buffer.from(lines[1], 'hex');
                        iv = Buffer.from(lines[2], 'hex');
                        encrypted = lines[3];
                        return [4 /*yield*/, this.deriveKey(password, salt)];
                    case 3:
                        key = _a.sent();
                        decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
                        decrypted = decipher.update(encrypted, 'hex', 'utf8');
                        decrypted += decipher.final('utf8');
                        return [4 /*yield*/, fs.writeFile(filename, decrypted)];
                    case 4:
                        _a.sent();
                        console.log('Decryption successful');
                        return [3 /*break*/, 6];
                    case 5:
                        error_2 = _a.sent();
                        console.error('Decryption failed:', error_2.message);
                        process.exit(1);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    VaultCLI.viewFile = function (filename) {
        return __awaiter(this, void 0, void 0, function () {
            var encryptedData, lines, password, salt, iv, encrypted, key, decipher, decrypted, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, fs.readFile(filename, 'utf8')];
                    case 1:
                        encryptedData = _a.sent();
                        lines = encryptedData.split('\n');
                        if (lines[0] !== this.HEADER.trim()) {
                            throw new Error('Invalid vault format');
                        }
                        return [4 /*yield*/, this.getPassword()];
                    case 2:
                        password = _a.sent();
                        salt = Buffer.from(lines[1], 'hex');
                        iv = Buffer.from(lines[2], 'hex');
                        encrypted = lines[3];
                        return [4 /*yield*/, this.deriveKey(password, salt)];
                    case 3:
                        key = _a.sent();
                        decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
                        decrypted = decipher.update(encrypted, 'hex', 'utf8');
                        decrypted += decipher.final('utf8');
                        console.log(decrypted);
                        return [3 /*break*/, 5];
                    case 4:
                        error_3 = _a.sent();
                        console.error('View failed:', error_3.message);
                        process.exit(1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    VaultCLI.editFile = function (filename) {
        return __awaiter(this, void 0, void 0, function () {
            var tempDir, tempFile, encryptedData, lines, password, salt, iv, encrypted, key, decipher, decrypted, editor, editProcess_1, editedContent, newSalt, newIv, newKey, cipher, newEncrypted, newOutput, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 10, , 11]);
                        tempDir = os.tmpdir();
                        tempFile = path.join(tempDir, "vault_edit_".concat(Date.now()));
                        return [4 /*yield*/, fs.readFile(filename, 'utf8')];
                    case 1:
                        encryptedData = _a.sent();
                        lines = encryptedData.split('\n');
                        if (lines[0] !== this.HEADER.trim()) {
                            throw new Error('Inalid vault format');
                        }
                        return [4 /*yield*/, this.getPassword()];
                    case 2:
                        password = _a.sent();
                        salt = Buffer.from(lines[1], 'hex');
                        iv = Buffer.from(lines[2], 'hex');
                        encrypted = lines[3];
                        return [4 /*yield*/, this.deriveKey(password, salt)];
                    case 3:
                        key = _a.sent();
                        decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
                        decrypted = decipher.update(encrypted, 'hex', 'utf8');
                        decrypted += decipher.final("utf8");
                        return [4 /*yield*/, fs.writeFile(tempFile, decrypted)];
                    case 4:
                        _a.sent();
                        editor = process.env.EDITOR || 'nano';
                        editProcess_1 = (0, node_child_process_1.spawn)(editor, [tempFile], { stdio: 'inherit' });
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                editProcess_1.on('close', function (code) {
                                    if (code === 0)
                                        resolve(true);
                                    else
                                        reject(new Error('Edit process failed'));
                                });
                            })];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, fs.readFile(tempFile, 'utf8')];
                    case 6:
                        editedContent = _a.sent();
                        newSalt = crypto.randomBytes(this.SALT_SIZE);
                        newIv = crypto.randomBytes(16);
                        return [4 /*yield*/, this.deriveKey(password, newSalt)];
                    case 7:
                        newKey = _a.sent();
                        cipher = crypto.createCipheriv('aes-256-cbc', newKey, newIv);
                        newEncrypted = cipher.update(editedContent, 'utf8', 'hex');
                        newEncrypted += cipher.final('hex');
                        newOutput = [
                            this.HEADER.trim(),
                            newSalt.toString('hex'),
                            newIv.toString('hex'),
                            newEncrypted,
                        ].join("\n");
                        return [4 /*yield*/, fs.writeFile(filename, newOutput)];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, fs.unlink(tempFile)];
                    case 9:
                        _a.sent();
                        console.log('File edited and re-encrypted successfully');
                        return [3 /*break*/, 11];
                    case 10:
                        error_4 = _a.sent();
                        console.error('Edit failed: ', error_4.messaege);
                        process.exit(1);
                        return [3 /*break*/, 11];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    VaultCLI.showHelp = function () {
        console.log("\nUsage: ./main.js <command> <file>\n\nCommands:\n  encrypt <file>    Encrypt a file\n  decrypt <file>    Decrypt a file\n  view <file>       View encrypted file contents\n  edit <file>\t\tEdit and encrypted file\n  help              Show this help message\n\nExamples:\n  ./main.js encrypt secrets.txt\n  ./main.js decrypt secrets.txt\n  ./main.js view secrets.txt\n  ./main.js edit secrets.txt\n    ");
    };
    VaultCLI.SALT_SIZE = 32;
    VaultCLI.ITERATIONS = 10000;
    VaultCLI.KEY_LENGTH = 32;
    VaultCLI.HEADER = '$VAULTCLI;VERSION=1.0;CIPHER=AES-256-CBC\n';
    return VaultCLI;
}());
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var args, command, filename, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    args = process.argv.slice(2);
                    if (args.length < 1 ||
                        args[0] === 'help' ||
                        args[0] === '--help' ||
                        args[0] === '-h') {
                        VaultCLI.showHelp();
                        process.exit(0);
                    }
                    if (args.length < 2) {
                        console.error('Error: Please provide both command and filename');
                        VaultCLI.showHelp();
                        process.exit(1);
                    }
                    command = args[0];
                    filename = args[1];
                    _a = command;
                    switch (_a) {
                        case 'encrypt': return [3 /*break*/, 1];
                        case 'decrypt': return [3 /*break*/, 3];
                        case 'view': return [3 /*break*/, 5];
                        case 'edit': return [3 /*break*/, 7];
                    }
                    return [3 /*break*/, 9];
                case 1: return [4 /*yield*/, VaultCLI.encryptFile(filename)];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 10];
                case 3: return [4 /*yield*/, VaultCLI.decryptFile(filename)];
                case 4:
                    _b.sent();
                    return [3 /*break*/, 10];
                case 5: return [4 /*yield*/, VaultCLI.viewFile(filename)];
                case 6:
                    _b.sent();
                    return [3 /*break*/, 10];
                case 7: return [4 /*yield*/, VaultCLI.editFile(filename)];
                case 8:
                    _b.sent();
                    return [3 /*break*/, 10];
                case 9:
                    console.error('Error: Unknown command');
                    VaultCLI.showHelp();
                    process.exit(1);
                    _b.label = 10;
                case 10: return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error('Error:', error.message);
    process.exit(1);
});
