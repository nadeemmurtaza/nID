import { decideFromExifTags, readExifTags } from './exif-consistency';
import { buildJpegWithExif } from './test-helpers/exif-fixture';

describe('decideFromExifTags (pure decision logic)', () => {
  it('is clean when no tags were found at all', () => {
    const result = decideFromExifTags({});
    expect(result.hasExif).toBe(false);
    expect(result.editingSoftwareDetected).toBe(false);
    expect(result.timestampInconsistency).toBe(false);
    expect(result.suspicious).toBe(false);
  });

  it('is clean for camera metadata with no editor and matching timestamps', () => {
    const captured = new Date('2024-01-15T10:00:00Z');
    const result = decideFromExifTags({
      make: 'Apple',
      model: 'iPhone 14',
      software: '17.2',
      dateTimeOriginal: captured,
      modifyDate: captured,
    });
    expect(result.hasExif).toBe(true);
    expect(result.suspicious).toBe(false);
  });

  it('flags a known image-editor Software tag', () => {
    const result = decideFromExifTags({ software: 'Adobe Photoshop 25.0 (Windows)' });
    expect(result.editingSoftwareDetected).toBe(true);
    expect(result.suspicious).toBe(true);
  });

  it('is case-insensitive and matches a substring within a longer Software string', () => {
    const result = decideFromExifTags({ software: 'GIMP 2.10.34' });
    expect(result.editingSoftwareDetected).toBe(true);
  });

  it('does not flag an unrecognized Software string as an editor', () => {
    const result = decideFromExifTags({ software: 'Canon Firmware 1.4.2' });
    expect(result.editingSoftwareDetected).toBe(false);
    expect(result.suspicious).toBe(false);
  });

  it('flags a capture-vs-modify timestamp gap beyond the drift tolerance', () => {
    const result = decideFromExifTags({
      dateTimeOriginal: new Date('2024-01-15T10:00:00Z'),
      modifyDate: new Date('2024-03-20T18:45:12Z'),
    });
    expect(result.timestampInconsistency).toBe(true);
    expect(result.suspicious).toBe(true);
  });

  it('tolerates a few seconds of drift between the two timestamps', () => {
    const result = decideFromExifTags({
      dateTimeOriginal: new Date('2024-01-15T10:00:00Z'),
      modifyDate: new Date('2024-01-15T10:00:05Z'),
    });
    expect(result.timestampInconsistency).toBe(false);
  });
});

describe('readExifTags (live, against real EXIF bytes)', () => {
  it('extracts Make/Model/Software/timestamps from a real hand-built EXIF segment', async () => {
    const imageBytes = buildJpegWithExif({
      make: 'TestCam',
      model: 'TestCam X',
      software: 'Adobe Photoshop 25.0',
      modifyDate: '2024:03:20 18:45:12',
      dateTimeOriginal: '2024:01:15 10:00:00',
    });

    const tags = await readExifTags(imageBytes);

    expect(tags.make).toBe('TestCam');
    expect(tags.model).toBe('TestCam X');
    expect(tags.software).toBe('Adobe Photoshop 25.0');
    expect(tags.dateTimeOriginal?.toISOString()).toContain('2024-01-15');
    expect(tags.modifyDate?.toISOString()).toContain('2024-03-20');

    const result = decideFromExifTags(tags);
    expect(result.editingSoftwareDetected).toBe(true);
    expect(result.timestampInconsistency).toBe(true);
    expect(result.suspicious).toBe(true);
  });

  it('reports no EXIF for a plain image with no APP1 segment at all', async () => {
    const { Jimp } = await import('jimp');
    const plain = new Jimp({ width: 40, height: 40, color: 0xffffffff });
    const imageBytes = await plain.getBuffer('image/jpeg');

    const tags = await readExifTags(imageBytes);
    const result = decideFromExifTags(tags);

    expect(result.hasExif).toBe(false);
    expect(result.suspicious).toBe(false);
  });
});
