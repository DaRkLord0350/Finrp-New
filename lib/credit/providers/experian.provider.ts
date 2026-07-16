import { BureauHttpProvider } from "./base-http.provider";
import type { Bureau } from "../config";

export class ExperianProvider extends BureauHttpProvider {
  protected readonly bureauKey: Bureau = "EXPERIAN";
}
