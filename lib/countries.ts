// 이 앱이 다루는 나라 목록. 나라를 추가하거나 빼려면 여기와 data/documents의 근거 문서를 함께 고친다.
// 순서는 답변 표와 보고서에 나오는 순서이기도 하다.

export const COUNTRY_CODES = ["KR", "JP", "CN", "US"] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];
