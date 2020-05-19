#!/usr/bin/env node

import program from 'commander';

program
  .version('0.0.0')
  .description('Downloads page from internet and saves it in specified directory')
  .arguments('<directory> <URL>')
  .action(() => {});

program.parse(process.argv);
