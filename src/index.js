import {
  downloadPage,
  downloadResource,
  changeResourcesLinks,
} from './utils.js';

export default (dirpath, url) => downloadPage(dirpath, url)
  .then((links) => links.forEach((link) => downloadResource(dirpath, url, link)))
  .then(() => changeResourcesLinks(dirpath, url));
