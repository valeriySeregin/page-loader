import downloadPageWithResources from '../src';

test('downloading fails on incorrect URL', async () => {
  await expect(downloadPageWithResources('mySuperDirectory', 'https://somename.smt')).rejects.toThrow(
    expect.objectContaining({ message: 'getaddrinfo ENOTFOUND somename.smt' }),
  );
});

test('downloading fails on incorrect directory path', async () => {
  await expect(downloadPageWithResources('mySuperDirectory', 'https://ru.hexlet.io')).rejects.toThrow(
    expect.objectContaining({ message: 'ENOENT: no such file or directory, mkdir \'mySuperDirectory/ru-hexlet-io_files\'' }),
  );
});
