import downloadPageWithResources from '../src';

test.each([
  ['mySuperDirectory', 'https://somename.smt', { message: 'getaddrinfo ENOTFOUND somename.smt' }],
  ['mySuperDirectory', 'https://ru.hexlet.io', { message: 'ENOENT: no such file or directory, mkdir \'mySuperDirectory/ru-hexlet-io_files\'' }],
])('downloadLocalResource(%s, %s, %o)', async (dirname, URL, expected) => {
  await expect(downloadPageWithResources(dirname, URL)).rejects.toThrow(
    expect.objectContaining(expected),
  );
});
