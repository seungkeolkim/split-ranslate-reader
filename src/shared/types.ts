export type TargetLang = "auto" | "ko" | "en" | "ja" | "zh-CN" | "zh-TW";

export interface StorageSchema {
  targetLang?: TargetLang;
}
