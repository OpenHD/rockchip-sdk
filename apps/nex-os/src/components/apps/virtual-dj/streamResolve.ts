/**
 * Thin wrapper — NEX DJ uses the same YouTube stream pipeline as NEX Music.
 */
export {
  hasMusicServer,
  resolveYoutubeStream as resolveDjStream,
  type StreamResolveResult as DjStreamResult,
} from '../../../utils/youtubeStream';
