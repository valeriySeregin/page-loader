#!/usr/bin/env node

import program from 'commander';
import { version } from '../../package.json';
import getHTMLPage from '..';

program
  .version(version)
  .description('Downloads page from internet and saves it in specified directory')
  .option('-o, --output [directory]', 'destination directory', process.cwd())
  .arguments('<URL>')
  .action((url, options) => {
    getHTMLPage(options.output, url)
      .catch((err) => {
        console.error(`process.exit([code]) initialized. Next error has been caugth: ${err}.`);
        process.exit(1);
      });
  });

program.parse(process.argv);
