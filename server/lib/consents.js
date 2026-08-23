// Version stamp for the current legal document set (terms/privacy/refund
// policy + contract templates). Bump this string whenever the underlying
// documents change so historical consent records stay accurate.
const CONSENT_VERSION = '2026-08-23';

const CONSENT_TYPES = {
  TERMS: 'terms',
  PRIVACY_CHECK: 'privacy_check',
  PRIVACY_COLLECT: 'privacy_collect',
  AGE19: 'age19',
  MARKETING: 'marketing',
  MARKETING_SMS: 'marketing_sms',
  MARKETING_EMAIL: 'marketing_email',
  MARKETING_MESSAGE: 'marketing_message',
  MARKETING_PUSH: 'marketing_push',
  MEMBER_INFO_SHARE: 'member_info_share',
  TRAVEL_THIRD_PARTY: 'travel_third_party',
  CONTRACT_CONTENT: 'contract_content',
  CONTRACT_MATCH_COUNT: 'contract_match_count',
  CONTRACT_SERVICE_PERIOD: 'contract_service_period',
  CONTRACT_FEES: 'contract_fees',
  CONTRACT_REFUND_LIMIT: 'contract_refund_limit',
  CONTRACT_NO_GUARANTEE: 'contract_no_guarantee',
};

module.exports = { CONSENT_VERSION, CONSENT_TYPES };
