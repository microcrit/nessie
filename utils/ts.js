import { execSync } from 'child_process';
import { readFileSync, statSync } from 'fs';

export function tsParse(content) {
    console.log(content);
    let raw = content;

    if (!raw.startsWith('@')) throw new Error('Invalid syntax');
    const path = 'torrents/' + content.split('/')[0].slice(1);
    const paths = content.split('/').slice(1);
    let result = [];

    const recurse = (index, current) => {
        if (index === paths.length) {
            result.push(current);
            return;
        }
        const path = paths[index];
        if (path.startsWith('{') && path.endsWith('}')) {
            const options = path.slice(1, -1).split(',');
            for (const option of options) {
                recurse(index + 1, `${current}/${option}`);
            }
        } else {
            recurse(index + 1, `${current}/${path}`);
        }
    };

    recurse(0, path);

    result = result.filter(path => {
        try {
            statSync(path);
            return true;
        } catch (e) {
            return false;
        }
    });

    return result;
}