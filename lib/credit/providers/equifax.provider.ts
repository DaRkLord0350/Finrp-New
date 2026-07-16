import { BureauHttpProvider } from "./base-http.provider";
import type { Bureau } from "../config";

export class EquifaxProvider extends BureauHttpProvider {
  protected readonly bureauKey: Bureau = "EQUIFAX";
}
