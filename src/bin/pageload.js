#!/usr/bin/env node

import program from 'commander';
import getHTMLPage from '..';

program
  .version('0.0.1')
  .description('Downloads page from internet and saves it in specified directory')
  .option('-o, --output [type]', 'destination directory', process.cwd())
  .arguments('<URL>')
  .action((url, options) => {
    getHTMLPage(options.output, url);
    console.log(`Page from ${url} downloaded successfully!`);
  });

program.parse(process.argv);
