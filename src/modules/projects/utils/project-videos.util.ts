import type { ProjectVideo } from '../../../database/entities/project.entity';

type VideoInput = { title?: string | null; url?: string | null };

/**
 * Cleans videos coming from the CRM: trims both fields, drops rows with no
 * link, and stores a blank title as null so readers have one "untitled" case.
 */
export function cleanVideos(input: VideoInput[]): ProjectVideo[] {
  return input.flatMap((video) => {
    const url = (video?.url ?? '').trim();
    if (!url) return [];
    const title = (video?.title ?? '').trim();
    return [{ title: title || null, url }];
  });
}

/**
 * The fields a save writes when the payload carries `videos`, or nothing
 * when it doesn't (a partial update must not wipe them). `videoUrls` is
 * mirrored so anything still reading the plain link list stays in step.
 */
export function videoFields(input: VideoInput[] | undefined) {
  if (input === undefined) return {};
  const videos = cleanVideos(input);
  return { videos, videoUrls: videos.map((video) => video.url) };
}

/**
 * Videos for a reader. Projects saved before titles existed only have
 * `videoUrls`; those come back untitled rather than missing.
 */
export function readVideos(project: {
  videos?: ProjectVideo[] | null;
  videoUrls?: string[] | null;
}): ProjectVideo[] {
  if (Array.isArray(project.videos) && project.videos.length > 0) {
    return cleanVideos(project.videos);
  }
  return cleanVideos((project.videoUrls ?? []).map((url) => ({ url })));
}
