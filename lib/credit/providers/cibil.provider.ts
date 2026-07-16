import { BureauHttpProvider } from "./base-http.provider";
import type { Bureau } from "../config";

export class CIBILProvider extends BureauHttpProvider {
  protected readonly bureauKey: Bureau = "CIBIL";
}
