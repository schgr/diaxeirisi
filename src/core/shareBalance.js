function calculateShareBalance(accountingBalance, chargedQuantity) {
  const availableQuantity = Number(accountingBalance) - Number(chargedQuantity);
  const differenceQuantity = Number(chargedQuantity) - Number(accountingBalance);

  if (differenceQuantity > 0) {
    return {
      availableQuantity,
      differenceQuantity,
      status: 'Πλεόνασμα',
      statusTone: 'surplus'
    };
  }

  return {
    availableQuantity,
    differenceQuantity,
    status: differenceQuantity === 0 ? 'Ισοσκελισμένο' : 'Έλλειμμα',
    statusTone: differenceQuantity === 0 ? 'balanced' : 'deficit'
  };
}

module.exports = {
  calculateShareBalance
};
