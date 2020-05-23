import { promises as fs } from 'fs';
import axios from 'axios';
import path from 'path';

const getFileName = (url) => {
  const [, ...urlComponents] = url.split(/\/\/|\.|\//);
  return `${urlComponents.join('-')}.html`;
};

export default (dirpath, url) => {
  const filename = getFileName(url);
  const promise = axios(url)
    .then((response) => fs.writeFile(path.join(dirpath, filename), response.data));

  return promise;
};
