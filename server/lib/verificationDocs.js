const VERIFY_DOCS = {
  marital: {
    title: '혼인관계증명서(상세) 인증',
    slots: [{ key: 'maritalcert', label: '혼인관계증명서(상세)' }],
  },
  job: {
    title: '직업 인증',
    slots: [
      { key: 'bizreg', label: '사업자등록증(사업자등록증, 사업자등록증명원 중 택1)' },
      { key: 'employment', label: '재직증명서(건강보험 자격득실확인서, 국민연금 가입증명서 중 택1)' },
    ],
  },
  education: {
    title: '학력 인증',
    slots: [{ key: 'diploma', label: '졸업증명서' }],
  },
  income: {
    title: '소득 인증',
    slots: [{ key: 'incomecert', label: '소득금액증명원' }],
  },
  asset: {
    title: '자산 인증',
    slots: [{ key: 'realestate', label: '등기부등본' }],
  },
};

const VERIFY_TYPES = Object.keys(VERIFY_DOCS);

function isValidSlot(type, slotKey) {
  const config = VERIFY_DOCS[type];
  if (!config) return false;
  return config.slots.some((s) => s.key === slotKey);
}

module.exports = { VERIFY_DOCS, VERIFY_TYPES, isValidSlot };
