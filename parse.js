const fs = require('fs')

fs.readFile(process.argv[2], 'utf8', (err, data) => {
  const schema = parse(data);
  // console.log(JSON.stringify(schema, '', 2));
  console.log(markdown(schema));
});

let description;

const primitiveTypes = new Set(['integer', 'number', 'boolean', 'string', 'object', 'any', 'array']);

function assignType(item, type, isArray) {
  if (isArray) {
    item.type = 'array';
    item.items = {};
    assignType(item.items, type);
    return;
  }
  if (type === 'enum')
    type = 'string';
  if (primitiveTypes.has(type))
    item.type = type;
  else
    item['$ref'] = type;
}

function createItem(experimental, deprecated, name) {
  const result = {};
  if (experimental)
    result.experimental = true;
  if (deprecated)
    result.deprecated = true;
  if (name)
    result.name = name;
  if (description)
    result.description = description.trim();
  return result;
}

function parse(data) {
  const protocol = { domains: [], version: {} };
  let domain;
  let item;
  let subitems;
  let nukeDescription = false;
  const lines = data.split('\n');
  for (let i = 0; i < lines.length; ++i) {
    if (nukeDescription) {
      description = '';
      nukeDescription = false;
    }
    const line = lines[i];
    const trimLine = line.trim();

    if (trimLine.startsWith('#')) {
      description += '\n' + trimLine.substring(2);
      continue;
    } else {
      nukeDescription = true;
    }

    if (!trimLine)
      continue;

    let match = line.match(/^(experimental )?(deprecated )?domain (.*)/);
    if (match) {
      domain = createItem(match[1], match[2]);
      domain.domain = match[3];
      protocol.domains.push(domain);
      continue;
    }

    match = line.match(/^  depends on ([^\s]+)/);
    if (match) {
      if (!domain.dependencies)
        domain.dependencies = [];
      domain.dependencies.push(match[1]);
      continue;
    }

    match = line.match(/^  (experimental )?(deprecated )?type (.*) extends (array of )?([^\s]+)?/);
    if (match) {
      if (!domain.types)
        domain.types = [];
      item = createItem(match[1], match[2]);
      item.id = match[3];
      assignType(item, match[5], match[4]);
      domain.types.push(item);
      continue;
    }

    match = line.match(/^  (experimental )?(deprecated )?(command|event) (.*)/);
    if (match) {
      let list;
      if (match[3] === 'command') {
        list = domain.commands;
        if (!list)
        list = domain.commands = [];
      } else {
        list = domain.events;
        if (!list)
        list = domain.events = [];
      }
      item = createItem(match[1], match[2], match[4]);
      list.push(item);
      continue;
    }

    match = line.match(/^      (experimental )?(deprecated )?(optional )?(array of )?([^\s]+) ([^\s]+)/);
    if (match) {
      let param = createItem(match[1], match[2], match[6]);
      if (match[3])
        param.optional = true;
      assignType(param, match[5], match[4]);
      if (match[5] === 'enum')
        enumliterals = param.enum = [];
      subitems.push(param);
      continue;
    }

    match = line.match(/^    (parameters|returns|properties)/);
    if (match) {
      subitems = item[match[1]] = [];
      continue;
    }

    match = line.match(/^    enum/);
    if (match) {
      enumliterals = item.enum = [];
      continue;
    }

    match = line.match(/^version/);
    if (match)
      continue;

    match = line.match(/^  major (\d+)/);
    if (match) {
      protocol.version.major = match[1];
      continue;
    }

    match = line.match(/^  minor (\d+)/);
    if (match) {
      protocol.version.minor = match[1];
      continue;
    }

    match = line.match(/^    redirect ([^\s]+)/);
    if (match) {
      item.redirect = match[1];
      continue;
    }

    match = line.match(/^      (  )?[^\s]+$/);
    if (match) {
      // enum literal
      enumliterals.push(trimLine);
      continue;
    }
    console.log(`Error in line: ${i+1}, ${line}`);

  }
  return protocol;
}

function markdown(schema) {
  const result = [];
  for (let domain of schema.domains) {
    result.push(`\n### ${domain.domain}`);
    if (domain.description)
      result.push(`\n${domain.description}`);
    for (let command of (domain.commands || [])) {
      const params = (command.parameters || []).map(p => p.name);
      result.push(`\n#### \`${command.name}(${params.join(', ')})\``);
      if (command.description)
        result.push(`\n${command.description}`);
    }
    result.push(`\n---`);
  }
  return result.join('\n');
}
