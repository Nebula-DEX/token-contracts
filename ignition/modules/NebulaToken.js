const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("NebulaToken", (m) => {
  const name = m.getParameter("name", "Nebula Token");
  const symbol = m.getParameter("symbol", "NEB");
  const initialSupply = m.getParameter("initialSupply", "10000000000000000000000000000");
  const mintStartYear = m.getParameter("mintStartYear_", "2");
  const initialInflationRate = m.getParameter("initialInflationRate_", "500");
  const inflationRateDecay = m.getParameter("inflationRateDecay_", "4");

  const nebulaToken = m.contract("NebulaToken", [name, symbol, initialSupply, mintStartYear, initialInflationRate, inflationRateDecay]);

  return { nebulaToken };
});