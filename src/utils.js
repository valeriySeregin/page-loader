import { promises as fs } from 'fs';
import axios from 'axios';
import path from 'path';
import cheerio from 'cheerio';
import _ from 'lodash';

export const getName = (url, type = 'file') => {
  const urlComponents = url.split(/\/\/|\.|\//);

  const names = {
    file: `${_.initial(urlComponents).join('-')}.${_.last(urlComponents)}`,
    page: `${_.tail(urlComponents).join('-')}.html`,
    directory: `${_.tail(urlComponents).join('-')}_files`,
  };

  return names[type];
};

export const getLocalLinks = (html) => {
  const $ = cheerio.load(html, { decodeEntities: false });
  const links = $('link, script, img')
    .toArray()
    .map((element) => $(element).attr('href') || $(element).attr('src'))
    .filter((element) => element)
    .filter((link) => link.split('//').length === 1);

  return links;
};

export const downloadPage = (dirpath, url) => {
  const filename = getName(url, 'page');
  const dirname = getName(url, 'directory');
  let html;

  return axios(url)
    .then(({ data }) => {
      html = data;
    })
    .then(() => fs.mkdir(path.join(dirpath, dirname)))
    .then(() => fs.writeFile(path.join(dirpath, filename), html))
    .then(() => getLocalLinks(html));
};

export const downloadResource = (dirpath, url, link) => {
  const filename = getName(link);
  const dirname = getName(url, 'directory');
  let resource;

  return axios(`${url}/${link}`)
    .then(({ data }) => {
      resource = data;
    })
    .then(() => fs.writeFile(path.join(dirpath, dirname, filename), resource));
};

export const changeResourcesLinks = (filepath, url) => {
  console.log(filepath);
  const dirname = getName(url, 'directory');

  return fs.readFile(filepath, 'utf-8')
    .then((html) => {
      const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
      $('link, script, img')
        .each((i, tag) => {
          const mapping = {
            img: 'src',
            link: 'href',
            script: 'href',
          };
          const oldAttr = $(tag).attr('href') || $(tag).attr('src');
          const attrToChange = mapping[tag.name];
          $(tag).attr(attrToChange, `${dirname}/${oldAttr}`);
        });
      fs.writeFile(filepath, $.html());
    });
};
