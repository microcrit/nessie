import fs from "fs";

import { npParse } from "./utils/np.js";
import { request } from 'undici';
import { JSDOM } from 'jsdom';
import { stdout } from "process";

if (!fs.existsSync('torrents')) {
    fs.mkdirSync('torrents');
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

console.log('\n---[ Syncing paths... ]---\n');

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
        stdout.write(revHistory[i]);
    }
}

function clearLine(y) { 
    cursorTo(0, y);
    stdout.write(' '.repeat(stdout.columns));
}

for (let path of dPaths) {
    let content = fs.readFileSync(path, 'utf-8');
    let parsed = npParse(content);

    const { url, raw, selector, extractor } = parsed;

    cursorTo(0, stdout.rows - 5);
    clearLine(stdout.rows - 5);
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
    clearLine(stdout.rows - 4);
    process.stdout.write('  --> Result: ' + result);
    history.push(`[${path}] -> ${result}`);
    progress++;
    drawProgressBar(progress, total);
    drawHistory();
    pathMaps[path] = result;
}

cursorTo(0, 0);
console.clear();

console.log('\n---[ Saving torrents... ]---\n');

for (let path in pathMaps) {
    let result = pathMaps[path];
    let outputPath = path.replace('paths', 'torrents').replace('.np', '.torrent');

    let dirs = outputPath.split('/');
    dirs.pop();
    let dir = dirs.join('/');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    console.log('~> Saving ' + outputPath);
    let stream = fs.createWriteStream(outputPath, { flags: 'w' });
    let content = await request2(result, {
        maxRedirections: 10
    });
    console.log('  --> Status: ' + content.statusCode);
    content.body.pipe(stream);

    console.log();
}