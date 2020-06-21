#!/usr/bin/env node

import program from 'commander';
import getHTMLPage from '..';

program
  .version('0.0.2')
  .description('Downloads page from internet and saves it in specified directory')
  .option('-o, --output [type]', 'destination directory', process.cwd())
  .arguments('<URL>')
  .action((url, options) => {
    getHTMLPage(options.output, url)
      .catch((err) => {
        console.error(` process.exit([code]) initialized. Next error has been caugth: ${err}.`);
        process.exit(1);
      });
  });

program.parse(process.argv);
