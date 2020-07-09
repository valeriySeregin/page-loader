import { promises as fs } from 'fs';
import axios from 'axios';
import path from 'path';
import cheerio from 'cheerio';
import buildDebug from 'debug';
import Listr from 'listr';
import { URL } from 'url';
import _ from 'lodash';

const debug = buildDebug('page-loader');

const getName = (pageUrl, nameType = 'file') => {
  const linkWithoutProtocol = `${pageUrl.hostname}${pageUrl.pathname}`
    .replace(/\//g, '-')
    .replace(/\./, '-');

  const nameMapping = {
    file: `${_.trimStart(pageUrl.pathname, '/').replace(/\//g, '-')}`,
    page: `${linkWithoutProtocol}.html`,
    directory: `${linkWithoutProtocol}_files`,
  };

  debug(`${nameMapping[nameType]} name has been created for ${nameType} of ${pageUrl.href}`);

  return nameMapping[nameType];
};

const downloadResource = (pageUrl, localLink, outputDirname, filesDirectoryName) => {
  const downloadingLink = new URL(localLink, pageUrl);
  const writingPath = path.join(outputDirname, filesDirectoryName, getName(downloadingLink));

  debug(`Download resource from ${downloadingLink.toString()}`);

  return axios({
    method: 'get',
    url: downloadingLink.toString(),
    responseType: 'arraybuffer',
  })
    .then((resource) => fs.writeFile(writingPath, resource.data));
};

const changeLinksOnPage = (html, filesDirectoryName, urlOrigin, pageUrl) => {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });

  const mapping = {
    img: 'src',
    link: 'href',
    script: 'src',
  };

  const localLinks = $('link, script, img')
    .toArray()
    .map((element) => $(element).attr('href') || $(element).attr('src'))
    .filter((element) => element)
    .filter((link) => {
      const urlToCheckOrigin = new URL(link, pageUrl);

      return urlToCheckOrigin.origin === urlOrigin;
    });

  debug('Extracted local links:', localLinks);

  $('link, script, img')
    .each((i, tag) => {
      const oldAttr = $(tag).attr('href') || $(tag).attr('src');
      const urlBasedOnOldAttr = new URL(oldAttr, pageUrl);
      const attrToChange = mapping[tag.name];
      const newAttr = path.join(filesDirectoryName, getName(urlBasedOnOldAttr));
      const value = urlBasedOnOldAttr.origin === urlOrigin ? newAttr : oldAttr;
      $(tag).attr(attrToChange, value);
    });

  return {
    html: $.html(),
    localLinks,
  };
};

export default (outputDirname, url) => {
  const pageUrl = new URL(url);
  const pagename = getName(pageUrl, 'page');
  const filesDirectoryName = getName(pageUrl, 'directory');

  let changedPageInformation;

  debug(`Request to ${pageUrl.href}`);

  return axios(pageUrl.href)
    .then((response) => {
      const html = response.data;
      changedPageInformation = changeLinksOnPage(
        html,
        filesDirectoryName,
        pageUrl.origin,
        pageUrl.toString(),
      );
    })
    .then(() => fs.mkdir(path.join(outputDirname, filesDirectoryName)))
    .then(() => {
      const tasksForListr = changedPageInformation.localLinks.map((localLink) => ({
        title: localLink,
        task: () => downloadResource(
          pageUrl.toString(),
          localLink,
          outputDirname,
          filesDirectoryName,
        ),
      }));

      const tasks = new Listr(tasksForListr, { concurrent: true });

      return tasks.run();
    })
    .then(() => {
      const writingPath = path.join(outputDirname, pagename);
      return fs.writeFile(writingPath, changedPageInformation.html);
    });
};
