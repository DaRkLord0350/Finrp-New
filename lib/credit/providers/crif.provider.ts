import { BureauHttpProvider } from "./base-http.provider";
import type { Bureau } from "../config";

export class CRIFProvider extends BureauHttpProvider {
  protected readonly bureauKey: Bureau = "CRIF";
}
