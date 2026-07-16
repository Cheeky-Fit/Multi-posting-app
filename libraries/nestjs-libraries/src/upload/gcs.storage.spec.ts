jest.mock('@google-cloud/storage', () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const deleteFn = jest.fn().mockResolvedValue(undefined);
  const file = jest.fn(() => ({ save, delete: deleteFn }));
  const bucket = jest.fn(() => ({ file }));
  return { Storage: jest.fn().mockImplementation(() => ({ bucket })) };
});

jest.mock('file-type', () => ({
  fromBuffer: jest.fn().mockResolvedValue({ mime: 'image/png', ext: 'png' }),
}));

import { GcsStorage } from './gcs.storage';

describe('GcsStorage', () => {
  it('uploadFile returns a public URL under the bucket base', async () => {
    const storage = new GcsStorage('my-bucket', 'https://storage.googleapis.com/my-bucket');
    const result = await storage.uploadFile({
      buffer: Buffer.from('hello'),
      mimetype: 'image/png',
      originalname: 'x.png',
      size: 5,
    } as Express.Multer.File);
    expect(result.path).toMatch(/^https:\/\/storage\.googleapis\.com\/my-bucket\//);
  });
});
