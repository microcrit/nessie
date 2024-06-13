/*
    [ No Problem ] - A simple language to extract torrent files from websites
    Language Specification:
        First line: URL of the website and optionally 'raw'
        Second line: where(selector=text, sel=selector, attr=attr(attr=attr, content=content, position=start|end|any|equal))'
        Third line: extract(regex=regex(match=match, prefix=prefix, replace=replace), prefix=prefix, attr=attr)
        
        {
            url: string,
            raw: boolean,
            selector: {
                text: string,
                sel: string,
                attr: {
                    attr: string,
                    content: string,
                    position: string
                }
            },
            extractor: {
                regex: {
                    match: string,
                    prefix: string,
                    replace: string
                },
                prefix: string,
                attr: string
            }
        }
 */

import Joi from 'joi';

const SelectorAttributeOptionals = Joi.object({
    attr: Joi.string().allow(null),
    content: Joi.string().allow(null),
    position: Joi.custom((value, helpers) => {
        if (value !== 'start' && value !== 'end' && value !== 'any' && value !== 'equal') {
            return helpers.error('any.invalid');
        }
        return value;
    }, 'custom position validation').allow(null)
});

const SelectorOptionals = Joi.object({
    text: Joi.string().allow(null),
    sel: Joi.string().allow(null),
    attr: SelectorAttributeOptionals.allow(null),
});

const RegexExtractorRequireds = Joi.object({
    match: Joi.string().required(),
    prefix: Joi.string().allow(null).allow(''),
    replace: Joi.string().required()
});

const ExtractorOptionals = Joi.object({
    regex: RegexExtractorRequireds.allow(null),
    prefix: Joi.string().allow(null).allow(''),
    attr: Joi.string().allow(null).allow('')
});

const ParsedNPLang = Joi.object({
    url: Joi.string().required(),
    raw: Joi.bool().default(false),
    selector: SelectorOptionals.optional(),
    extractor: ExtractorOptionals.optional()
});

export function npParse(content) {
    let filteredLines = content.split('\n').filter(line => !line.startsWith('#') && line.trim() !== '');

    let url = filteredLines[0].split(' ')[0].trim();
    let type = (filteredLines[0].split(' ')[1] || '').trim();
    
    let raw = type === 'raw';

    let selectorRaw = raw ? null : filteredLines[1].split('where(')[1].split(')').slice(0, -1).join(')').trim();
    let selectorParams = raw ? null : Object.fromEntries(selectorRaw.split(',').map(param => [param.split('=')[0].trim(), param.split('=').slice(1).join('=').trim()]));

    let extractorRaw = raw ? null : filteredLines[2].split('extract(')[1].split(')').slice(0, -1).join(')').trim();
    let extractorParams = raw ? null : Object.fromEntries(extractorRaw.split(',').map(param => [param.split('=')[0].trim(), param.split('=').slice(1).join('=').trim()]));
    let regexParams = raw ? null : extractorParams.regex && extractorParams.regex.split('(').slice(1).join('(').split(')').slice(0, -1).join(')');

    let extractor = {
        regex: regexParams && {
            match: regexParams.split('->')[0].trim(),
            prefix: regexParams.split('->')[1].trim().split('+')[0].trim(),
            replace: regexParams.split('->')[1].trim().split('+')[1].trim()
        },
        prefix: (extractorParams || {}).prefix,
        attr: (extractorParams || {}).attr
    };

    let selectorAttrParams = raw ? null : selectorParams.attr && selectorParams.attr.split('(').slice(1).join('(').split(')').slice(0, -1).join(')');

    let result = {
        url: url,
        raw: raw,
        selector: {
            ...(selectorParams || {}),
            attr: selectorAttrParams && {
                attr: selectorAttrParams.split('->')[0].trim(),
                content: selectorAttrParams.split('->')[1].trim().split('<<')[0].trim(),
                position: selectorAttrParams.split('<<')[1].trim()
            }
        },
        extractor: extractor
    };

    let { error, value } = ParsedNPLang.validate(result);
    if (error) {
        throw error;
    }

    return value;
}