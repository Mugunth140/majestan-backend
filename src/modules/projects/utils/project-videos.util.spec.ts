import { cleanVideos, readVideos, videoFields } from './project-videos.util';

describe('project videos', () => {
  it('trims fields, drops link-less rows and stores a blank title as null', () => {
    expect(
      cleanVideos([
        { title: '  Walkthrough ', url: ' https://youtu.be/abc123def45 ' },
        { title: 'No link', url: '   ' },
        { title: '', url: 'https://youtu.be/xyz987uvw65' },
      ]),
    ).toEqual([
      { title: 'Walkthrough', url: 'https://youtu.be/abc123def45' },
      { title: null, url: 'https://youtu.be/xyz987uvw65' },
    ]);
  });

  it('mirrors the links into videoUrls when videos are saved', () => {
    expect(videoFields([{ title: 'Site tour', url: 'https://youtu.be/abc123def45' }])).toEqual({
      videos: [{ title: 'Site tour', url: 'https://youtu.be/abc123def45' }],
      videoUrls: ['https://youtu.be/abc123def45'],
    });
  });

  it('leaves both fields untouched on a partial update without videos', () => {
    expect(videoFields(undefined)).toEqual({});
  });

  it('clears both fields when the editor removes every video', () => {
    expect(videoFields([])).toEqual({ videos: [], videoUrls: [] });
  });

  it('reads legacy link-only projects back as untitled videos', () => {
    expect(readVideos({ videos: null, videoUrls: ['https://youtu.be/abc123def45'] })).toEqual([
      { title: null, url: 'https://youtu.be/abc123def45' },
    ]);
  });

  it('prefers titled videos over the legacy list', () => {
    expect(
      readVideos({
        videos: [{ title: 'Site tour', url: 'https://youtu.be/abc123def45' }],
        videoUrls: ['https://youtu.be/other000000'],
      }),
    ).toEqual([{ title: 'Site tour', url: 'https://youtu.be/abc123def45' }]);
  });
});
