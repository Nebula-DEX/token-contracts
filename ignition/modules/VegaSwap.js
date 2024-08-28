const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("VegaSwap", (m) => {
  const vegaToken = m.getParameter("vegaToken_", "0xcb84d72e61e383767c4dfeb2d8ff7f4fb89abc6e");
  const nebulaToken = m.getParameter("nebulaToken_", "0x6e9e554bbCa46Cd86684f85F4037360bDA382069");
  const nebulaAllocation = m.getParameter("nebulaAllocation_", "2000000000000000000000000000");
  const maxDilutionRatio = m.getParameter("maxDilutionRatio_", "5");
  const vegaSwapDeadline = m.getParameter("vegaSwapDeadline_", "1727308800");
  const nebulaLeftoverDeadline = m.getParameter("nebulaLeftoverDeadline_", "1729900800");

  const vegaSwap = m.contract("VegaSwap", [vegaToken, nebulaToken, nebulaAllocation, maxDilutionRatio, vegaSwapDeadline, nebulaLeftoverDeadline]);

  return { vegaSwap };
});