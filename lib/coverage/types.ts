export type NoticeCategory = "information" | "attention" | "blocking" | "application";

export interface EngineerNotice {
  backendState: string;
  category: NoticeCategory;
  headline: string;
  explanation: string;
  nextAction: string;
  procedureVisible: boolean;
  technicalDetail: string;
}

export interface CoverageFact {
  label: string;
  value: string;
  meaning: string;
}
