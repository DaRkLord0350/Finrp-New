export type WatchlistEntityType = "INDIVIDUAL" | "ORGANIZATION" | "VESSEL" | "OTHER";

export interface WatchlistEntryData {
  externalId: string;
  entityType: WatchlistEntityType;
  primaryName: string;
  aliases: string[];
  nationality?: string;
  dob?: string;
  program?: string;
  listedDate?: string;
  rawData: unknown;
}
