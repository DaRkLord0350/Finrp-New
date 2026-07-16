import {
  NegativeMediaEndpointNotBoundError,
  NegativeMediaNotConfiguredError,
  type NegativeMediaProvider,
  type NegativeMediaSearchInput,
  type NegativeMediaSearchResult,
} from "./types";

function assertConfigured() {
  const baseUrl = process.env.NEGATIVE_MEDIA_BASE_URL;
  const apiKey = process.env.NEGATIVE_MEDIA_API_KEY;
  if (!baseUrl || !apiKey) throw new NegativeMediaNotConfiguredError();
}

export class NegativeMediaHttpProvider implements NegativeMediaProvider {
  readonly name = "NEGATIVE_MEDIA_HTTP";

  async search(_input: NegativeMediaSearchInput): Promise<NegativeMediaSearchResult> {
    assertConfigured();
    throw new NegativeMediaEndpointNotBoundError("search");
  }
}
