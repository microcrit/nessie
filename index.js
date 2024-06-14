const originalEmit = process.emit;
process.emit = function (name, data, ...args) {
  if (
    name === `warning` &&
    typeof data === `object` &&
    data.name === `ExperimentalWarning` 
    //if you want to only stop certain messages, test for the message here:
    //&& data.message.includes(`Fetch API`)
  ) {
    return false;
  }
  return originalEmit.apply(process, arguments);
};

import fs from "fs";
import os from "os";

import { npParse } from "./utils/np.js";
import { request } from 'undici';
import { JSDOM } from 'jsdom';
import { stdin, stdout } from "process";
import { glob } from "glob";
import WebTorrent from 'webtorrent';

if (!fs.existsSync('torrents')) {
    fs.mkdirSync('torrents');
}

if (!fs.existsSync('downloads')) {
    fs.mkdirSync('downloads');
}

let paths = [];
function recursiveLoopDir(dir) {
    let files = fs.readdirSync(dir);
    for (let file of files) {
        let path = `${dir}/${file}`;
        if (fs.lstatSync(path).isDirectory()) {
            recursiveLoopDir(path);
        } else {
            if (path.endsWith('.np')) {
                paths.push(path);
            }
        }
    }
}
recursiveLoopDir('paths');

const dPaths = paths;
paths = [];

function findElementByText(document, text) {
    let elements = document.querySelectorAll('*');
    for (let element of elements) {
        if (element.textContent === text) {
            return element;
        }
    }
}

let pathMaps = {};

let headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
};

async function request2(url, options = { method: 'GET', headers: {} }) {
    return await request(url, {
        ...options,
        headers: {
            ...headers,
            ...options.headers
        }
    });
}

function cursorTo(x, y) {
    stdout.write(`\x1b[${y};${x}H`);
}

let history = [];
let progress = 0;
let total = dPaths.length;

function drawProgressBar(current, total) {
    cursorTo(0, stdout.rows - 1);
    let bar = '█'.repeat(current) + ' '.repeat(total - current);
    process.stdout.write(`\r|${bar}| ${current}/${total} (${Math.floor(current / total * 100)}%)`);
    cursorTo(0, stdout.rows - 4);
}

function drawHistory() {
    cursorTo(0, 0);
    for (let i = 0; i < stdout.rows - 5; i++) {
        stdout.write(' '.repeat(stdout.columns));
    }
    let revHistory = history.reverse();
    for (let i = 0; i < Math.min(stdout.rows - 5, revHistory.length); i++) {
        cursorTo(0, stdout.rows - 5 - i);
        stdout.write(revHistory[i].substring(0, stdout.columns - 5));
    }
}

function clearLine(y) { 
    cursorTo(0, y);
    stdout.write(' '.repeat(stdout.columns - 1));
}

let greps = process.argv.slice(2).filter(x => !x.startsWith('--'));

if (!process.argv.includes('--no-torrents')) {
    if (process.argv.includes('--torrents-clean')) {
        console.log('\n---[ Cleaning torrents... ]---\n');
        let files = fs.readdirSync('torrents');
        for (let file of files) {
            let path = `torrents/${file}`;
            if (fs.lstatSync(path).isDirectory()) {
                fs.rmdirSync(path, { recursive: true });
            } else {
                fs.unlinkSync(path);
            }
        }
        process.exit(0);
    }
    console.clear();

    for (let path of dPaths) {
        let content = fs.readFileSync(path, 'utf-8');
        let parsed = npParse(content);

        const { url, raw, selector, extractor } = parsed;

        clearLine(stdout.rows - 5);
        clearLine(stdout.rows - 4);
        cursorTo(0, stdout.rows - 4);
        stdout.write(`~> Extracting: ${path}`);

        let body,
            document;
        if (!raw) {
            body = (await request2(url)).body;
            const txt = await body.text();
            let dom = new JSDOM(txt);
            document = dom.window.document;
        }

        let element;
        if (!raw) {
            if (selector.attr) {
                let attr = selector.attr;
                let pos = selector.attr.position === "start" ? "^" : selector.attr.position === "end" ? "$" : selector.attr.position === "any" ? "*" : "";
                element = document.querySelector(`[${attr.attr}${pos}="${attr.content}"]`);
            } else if (selector.text) {
                element = findElementByText(document, selector.text);
            } else if (selector.sel) {
                let sel = selector.sel;
                element = document.querySelector(sel);
            } else {
                throw new Error('No selector provided');
            }

            if (!element) {
                throw new Error('Element not found');
            }
        }

        let result;
        if (!raw) {
            if (extractor.regex) {
                let regex = new RegExp(extractor.regex.match, "g");
                let match = [...regex.exec(element.textContent)];
                result = (extractor.regex.prefix || '') + match[parseInt(extractor.regex.replace.split('$')[1])];
            } else if (extractor.attr) {
                result = (extractor.prefix || '') + element.getAttribute(extractor.attr);
            } else {
                throw new Error('No extractor provided');
            }
        } else {
            result = url;
        }

        cursorTo(0, stdout.rows - 4);
        clearLine(stdout.rows - 3);
        cursorTo(0, stdout.rows - 3);
        process.stdout.write(('  --> Result: ' + result).substring(0, stdout.columns - 5));
        history.push(`[${path}] -> ${result}`);
        progress++;
        drawProgressBar(progress, total);
        drawHistory();
        pathMaps[path] = {
            url: result,
            magnet: extractor.magnet
        };
    }

    cursorTo(0, 0);
    console.clear();

    console.log('\n---[ Saving torrents... ]---\n');

    for (let path in pathMaps) {
        let result = pathMaps[path];
        if (!result.url) {
            console.log(`~> Skipping ${path}\n`);
            continue;
        }
        let outputPath;
        if (result.magnet) {
            outputPath = path.replace('paths', 'torrents').replace('.np', '.magnet');
            console.log('~> Saving magnet ' + outputPath);
            fs.writeFileSync(outputPath, result.url);
            console.log();
            continue;
        } else {
            outputPath = path.replace('paths', 'torrents').replace('.np', '.torrent');
        }

        let dirs = outputPath.split('/');
        dirs.pop();
        let dir = dirs.join('/');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        console.log('~> Saving torrent ' + outputPath);
        let stream = fs.createWriteStream(outputPath, { flags: 'w' });
        let content = await request2(result.url, {
            maxRedirections: 10
        });
        console.log('  --> Status: ' + content.statusCode);
        content.body.pipe(stream);

        console.log();
    }
}

console.clear();

Promise.chunk = async function (promises, chunkSize) {
    let results = [];
    for (let i = 0; i < promises.length; i += chunkSize) {
        let chunk = promises.slice(i, i + chunkSize);
        let result = await Promise.all(chunk);
        results.push(result);
    }
    return results;
}

function threadedForEach(array, callback, threads = os.cpus().length) {
    return new Promise(async (resolve, reject) => {
        let chunks = await Promise.chunk(array, threads);
        for (let chunk of chunks) {
            await Promise.all(chunk.map(callback));
        }
        resolve();
    });
}

async function tsParse(content) {
    return await glob("./torrents/" + content);
}  

if (!process.argv.includes('--no-dl')) {
    console.clear();
    if (process.argv.includes('--dl-clean')) {
        console.log('\n---[ Cleaning downloads... ]---\n');
        let files = fs.readdirSync('downloads');
        for (let file of files) {
            let path = `downloads/${file}`;
            if (fs.lstatSync(path).isDirectory()) {
                fs.rmdirSync(path, { recursive: true });
            } else {
                fs.unlinkSync(path);
            }
        }
        process.exit(0);
    }
    console.clear();

    let prevValues = {};

    console.log('\n---[ Pulling torrents... ]---\n');

    let paths = [];
    for (var x of greps) {
        let glob2 = await tsParse(x);
        paths = paths.concat(glob2);
    }
    console.log(paths);
    const client = new WebTorrent();
    threadedForEach(paths, async path => {
        let dir = path.split('/').slice(0, -1).join('/');
        if (!fs.existsSync(`downloads/${dir}`)) {
            fs.mkdirSync(`downloads/${dir}`, { recursive: true });
        }
        if (path.endsWith('.magnet')) {
            let magnet = fs.readFileSync(path, 'utf-8');
            console.log(('~> Downloading magnet ' + magnet).substring(0, stdout.columns - 5));
            client.add(magnet, torrent => {
                var file = torrent.files.find(file => file.name.endsWith('.iso'));
                if (!file) {
                    file = torrent.files[0];
                }
                var stream = fs.createWriteStream(`downloads/${path.split('/').slice(0, -1).join('/')}/${file.name}`);
                let rs = file.createReadStream();
                rs.pipe(stream);
                torrent.on('done', function () {
                    console.log('  --> Done with ' + file.name);
                    stream.close();
                });
            });
        } else {
            console.log(('~> Downloading torrent ' + path).substring(0, stdout.columns - 5));
            const buf = fs.readFileSync(path);
            client.add(buf, torrent => {
                var file = torrent.files.find(file => file.name.endsWith('.iso'));
                if (!file) {
                    file = torrent.files[0];
                }
                var stream = fs.createWriteStream(`downloads/${path.split('/').slice(0, -1).join('/')}/${file.name}`);
                let rs = file.createReadStream();
                rs.pipe(stream);
                torrent.on('done', function () {
                    delete prevValues[file.name];
                    clearLine(stdout.columns - 1);
                    clearLine(stdout.columns - 2);
                    clearLine(stdout.columns - 3);
                    clearLine(stdout.columns - 4);
                    drawProgressBar(Math.round(client.progress * 100), 100);
                    drawHistory();
                });
            });
        }
    });
    history = [];
    client.on('torrent', function (torrent) {
        let file = torrent.files.find(file => file.name.endsWith('.iso')) || torrent.files[0];
        prevValues[file.name] = 0;
        torrent.on('download', function () {
            if ((Math.round(torrent.progress * 100) - prevValues[file.name]) < 1) return;
            if (Math.round(torrent.progress * 100) === 100) {
                return;
            }
            history = Object.entries(prevValues).sort((a, b) => {
                return a[1] - b[1];
            }).map(([key, value]) => `[${key}] -> ${Math.round(value)}%`);
            prevValues[file.name] = torrent.progress * 100;
            clearLine(stdout.columns - 1);
            clearLine(stdout.columns - 2);
            clearLine(stdout.columns - 3);
            clearLine(stdout.columns - 4);
            drawProgressBar(Math.round(client.progress * 100), 100);
            drawHistory();
        });
    });
}

stdin.resume();
stdin.setEncoding('utf-8');
stdin.setRawMode(true);

stdin.on('data', function (key) {
    if (key === '\u0003') {
        process.kill(process.pid, 'SIGTERM');
    }
});