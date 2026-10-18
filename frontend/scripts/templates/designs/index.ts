import type { TemplateDesign } from '../registry'
import { youtubeThumbnail } from './youtubeThumbnail'
import { businessCard } from './businessCard'
import { botanicalInvitation } from './botanicalInvitation'
import { concertPoster } from './concertPoster'
import { eventStory } from './eventStory'
import { grandOpeningFlyer } from './grandOpeningFlyer'
import { modernResume } from './modernResume'
import { pitchDeck } from './pitchDeck'
import { quoteCard } from './quoteCard'
import { saleAnnouncement } from './saleAnnouncement'
import { FACTORY_DESIGNS } from './factory'
import { FACTORY_FORMAT_DESIGNS } from './factoryFormats'

/** The starter templates, in gallery order: the ten hand-made designs, then the factory catalogue. */
export const DESIGNS: readonly TemplateDesign[] = [saleAnnouncement, quoteCard, eventStory, pitchDeck, concertPoster, grandOpeningFlyer, botanicalInvitation, modernResume, youtubeThumbnail, businessCard, ...FACTORY_DESIGNS, ...FACTORY_FORMAT_DESIGNS]
