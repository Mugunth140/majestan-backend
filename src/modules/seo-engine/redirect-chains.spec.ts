import { collapseRedirects } from './seo-utils';

describe('collapseRedirects', () => {
  it('points every old URL at the end of its chain', () => {
    expect(
      collapseRedirects([
        { source: '/uptown-pa0009', destination: '/uptown-coimbatore-' },
        {
          source: '/uptown-coimbatore-',
          destination: '/uptown-coimbatore-pa0009',
        },
        { source: '/other-v1', destination: '/other-live-v1' },
      ]),
    ).toEqual([
      { source: '/uptown-pa0009', destination: '/uptown-coimbatore-pa0009' },
      {
        source: '/uptown-coimbatore-',
        destination: '/uptown-coimbatore-pa0009',
      },
      { source: '/other-v1', destination: '/other-live-v1' },
    ]);
  });

  it('stops on a loop instead of spinning', () => {
    const rows = collapseRedirects([
      { source: '/a', destination: '/b' },
      { source: '/b', destination: '/a' },
    ]);
    expect(rows).toHaveLength(2);
  });
});
