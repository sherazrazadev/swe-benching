package transaction_test

// Legitimate-use checks for royalty split settlement: valid configurations must keep
// working and the exact balances must be conserved. Every test drives the real
// transaction processor with the project's own in-memory account fixtures.

import (
	"encoding/hex"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/klever-io/klever-go/core"
	"github.com/klever-io/klever-go/core/process/kda/kdautils"
	txp "github.com/klever-io/klever-go/core/process/transaction"
	"github.com/klever-io/klever-go/data/block"
	"github.com/klever-io/klever-go/data/transaction"
	"github.com/klever-io/klever-go/kapps"
	"google.golang.org/protobuf/proto"
)

func funWriteAsset(t *testing.T, c *Controller, id []byte, assetType kapps.KDAData_EnumAssetType, royalties *kapps.RoyaltiesData) {
	t.Helper()
	asset := kapps.KDAData{
		ID:           id,
		AssetType:    assetType,
		Name:         []byte("FUNCTN"),
		Ticker:       id,
		OwnerAddress: sender,
		AdminAddress: admin,
		MaxSupply:    10_000_000,
		IssueDate:    time.Now().Unix(),
		Properties:   &kapps.PropertiesData{CanMint: true, CanFreeze: true, CanBurn: true},
		Attributes:   &kapps.AttributesData{},
		Roles:        []*kapps.RolesData{{Address: sender, HasRoleMint: true, HasRoleSetITOPrices: true}},
		Royalties:    royalties,
	}
	data, err := marshalizer.Marshal(&asset)
	require.NoError(t, err)
	require.NoError(t, c.kdaKapp.DataTrieTracker().SaveKeyValue(kdautils.ToKDAKey(id, nil), data))
	require.NoError(t, c.kappDB.SaveAccount(c.kdaKapp))
}

func funSend(t *testing.T, c *Controller, contract proto.Message, contractType transaction.TXContract_ContractType, signer []byte, blk *block.Block) (*transaction.Transaction, error) {
	t.Helper()
	tx, err := createTransactionMock(contract, contractType, signer, 0)
	require.NoError(t, err)
	_, hash, err := c.execTx.PreProcessTransaction(tx)
	require.NoError(t, err)
	return tx, c.execTx.ProcessTransaction(blk, hash, tx)
}

func funTransfer(t *testing.T, c *Controller, blk *block.Block, from, to, assetID []byte, amount, kdaRoyalties, klvRoyalties int64) error {
	t.Helper()
	contract := &transaction.TransferContract{
		ToAddress:    to,
		AssetID:      assetID,
		Amount:       amount,
		KDARoyalties: kdaRoyalties,
		KLVRoyalties: klvRoyalties,
	}
	_, err := funSend(t, c, contract, transaction.TXContract_TransferContractType, from, blk)
	return err
}

func funBalance(c *Controller, addr, assetID []byte) int64 {
	return loadUserAccount(c.accCacher, addr).GetBalance(assetID, true)
}

func funHasReceipt(tx *transaction.Transaction, rt txp.ReceiptType) bool {
	for _, r := range tx.Receipts {
		if len(r.Data) > 0 && len(r.Data[0]) > 0 && r.Data[0][0] == byte(rt) {
			return true
		}
	}
	return false
}

func funGetAsset(t *testing.T, c *Controller, id []byte) *kapps.KDAData {
	t.Helper()
	kappAcc := loadKAppAccount(c.accCacher, kapps.KDAKAppAddress)
	raw, err := kappAcc.DataTrieTracker().RetrieveValue(kdautils.ToKDAKey(id, nil))
	require.NoError(t, err)
	asset := &kapps.KDAData{}
	require.NoError(t, marshalizer.Unmarshal(asset, raw))
	return asset
}

// A split configuration that stays within the royalty at every step is legitimate and
// must be accepted at creation.
func TestFunc_Create_ValidSplitSharesAccepted(t *testing.T) {
	royalties := &transaction.RoyaltiesInfo{
		Address:            mainRoyaltyAddress,
		TransferPercentage: []*transaction.RoyaltyInfo{{Amount: 1000, Percentage: 500}},
		SplitRoyalties: map[string]*transaction.RoyaltySplitInfo{
			hex.EncodeToString(splitAddress1): {PercentTransferPercentage: 5000},
			hex.EncodeToString(splitAddress2): {PercentTransferPercentage: 5000},
		},
	}
	contract := &transaction.CreateAssetContract{
		Type:         transaction.CreateAssetContract_Fungible,
		Name:         []byte("FUNCTN"),
		Ticker:       []byte("FUNCTN"),
		OwnerAddress: sender,
		MaxSupply:    10000,
		Properties:   &transaction.PropertiesInfo{CanMint: true},
		Royalties:    royalties,
	}

	c := NewController(t)
	c.AddUser(sender, 1_000_000, kdautils.KLVIdentifier)

	tx, err := funSend(t, c, contract, transaction.TXContract_CreateAssetContractType, sender, createBlockHeader())
	require.NoError(t, err, "a legitimate split configuration must be accepted")
	require.True(t, funHasReceipt(tx, txp.CreateKDA), "a legitimate creation must create the asset")
}

// A legitimate royalty update must still be accepted and stored.
func TestFunc_Trigger_ValidSplitSharesStored(t *testing.T) {
	id := []byte("FUNUPD")
	original := &kapps.RoyaltiesData{
		Address:            mainRoyaltyAddress,
		TransferPercentage: []*kapps.RoyaltyData{{Amount: 1000, Percentage: 500}},
		SplitRoyalties:     map[string]*kapps.RoyaltySplitData{},
	}
	c := NewController(t)
	funWriteAsset(t, c, id, kapps.KDAData_Fungible, original)
	c.AddUser(sender, 1_000_000, kdautils.KLVIdentifier)

	royalties := &transaction.RoyaltiesInfo{
		Address:            mainRoyaltyAddress,
		TransferPercentage: []*transaction.RoyaltyInfo{{Amount: 1000, Percentage: 500}},
		SplitRoyalties: map[string]*transaction.RoyaltySplitInfo{
			hex.EncodeToString(splitAddress1): {PercentTransferPercentage: 4000},
			hex.EncodeToString(splitAddress2): {PercentTransferPercentage: 3000},
		},
	}
	contract := &transaction.AssetTriggerContract{
		TriggerType: transaction.AssetTriggerContract_UpdateRoyalties,
		AssetID:     id,
		Royalties:   royalties,
	}
	tx, err := funSend(t, c, contract, transaction.TXContract_AssetTriggerContractType, sender, createBlockHeader())
	require.NoError(t, err, "a legitimate royalty update must be accepted")
	require.True(t, funHasReceipt(tx, txp.UpdateKDA), "a legitimate update must store the configuration")

	stored := funGetAsset(t, c, id)
	require.Len(t, stored.Royalties.SplitRoyalties, 2)
	require.Equal(t, uint32(4000), stored.Royalties.SplitRoyalties[hex.EncodeToString(splitAddress1)].PercentTransferPercentage)
	require.Equal(t, uint32(3000), stored.Royalties.SplitRoyalties[hex.EncodeToString(splitAddress2)].PercentTransferPercentage)
}

// A transfer whose split shares stay inside the royalty must settle with exact balances.
func TestFunc_Transfer_SplitSharesWithinPoolSettle(t *testing.T) {
	id := []byte("FUNTRF")
	royalties := &kapps.RoyaltiesData{
		Address:            mainRoyaltyAddress,
		TransferPercentage: []*kapps.RoyaltyData{{Amount: 1000, Percentage: 500}},
		SplitRoyalties: map[string]*kapps.RoyaltySplitData{
			hex.EncodeToString(splitAddress1): {PercentTransferPercentage: 2700},
			hex.EncodeToString(splitAddress2): {PercentTransferPercentage: 1700},
		},
	}
	c := NewController(t)
	funWriteAsset(t, c, id, kapps.KDAData_Fungible, royalties)
	c.AddUser(sender, 1_000_000, id)
	c.AddUser(receiver, 0, nil)
	c.AddUser(splitAddress1, 0, nil)
	c.AddUser(splitAddress2, 0, nil)
	c.AddUser(mainRoyaltyAddress, 0, nil)
	blk := c.CreateBlockHeader(0, 1, 1)

	require.NoError(t, funTransfer(t, c, blk, sender, receiver, id, 800, 40, 0))
	require.Equal(t, int64(800), funBalance(c, receiver, id))
	require.Equal(t, int64(999_160), funBalance(c, sender, id), "payer debited the transfer amount plus the royalty")
	require.Equal(t, int64(10), funBalance(c, splitAddress1, id))
	require.Equal(t, int64(6), funBalance(c, splitAddress2, id))
	require.Equal(t, int64(24), funBalance(c, mainRoyaltyAddress, id))
}

// Sending the entire royalty to one split recipient is a legitimate configuration and
// must settle instead of being refused.
func TestFunc_Transfer_WholeRoyaltyToSingleSplitSettles(t *testing.T) {
	id := []byte("FUNALL")
	royalties := &kapps.RoyaltiesData{
		Address:            mainRoyaltyAddress,
		TransferPercentage: []*kapps.RoyaltyData{{Amount: 1000, Percentage: 500}},
		SplitRoyalties: map[string]*kapps.RoyaltySplitData{
			hex.EncodeToString(splitAddress1): {PercentTransferPercentage: core.HundredPercent},
		},
	}
	c := NewController(t)
	funWriteAsset(t, c, id, kapps.KDAData_Fungible, royalties)
	c.AddUser(sender, 1_000_000, id)
	c.AddUser(receiver, 0, nil)
	c.AddUser(splitAddress1, 0, nil)
	c.AddUser(mainRoyaltyAddress, 0, nil)
	blk := c.CreateBlockHeader(0, 1, 1)

	require.NoError(t, funTransfer(t, c, blk, sender, receiver, id, 800, 40, 0),
		"a recipient that takes the whole royalty is a legitimate configuration")
	require.Equal(t, int64(40), funBalance(c, splitAddress1, id))
	require.Equal(t, int64(0), funBalance(c, mainRoyaltyAddress, id))
	require.Equal(t, int64(800), funBalance(c, receiver, id))
}

// A fixed-royalty transfer whose split stays inside the fixed royalty must settle.
func TestFunc_Transfer_FixedSplitWithinPoolSettles(t *testing.T) {
	id := []byte("FUNFIX")
	royalties := &kapps.RoyaltiesData{
		Address:       mainRoyaltyAddress,
		TransferFixed: 1000,
		SplitRoyalties: map[string]*kapps.RoyaltySplitData{
			hex.EncodeToString(splitAddress1): {PercentTransferFixed: 3000},
		},
	}
	c := NewController(t)
	funWriteAsset(t, c, id, kapps.KDAData_Fungible, royalties)
	c.AddUser(sender, 1_000_000, kdautils.KLVIdentifier)
	c.AddUser(sender, 1_000_000, id)
	c.AddUser(receiver, 0, id)
	c.AddUser(splitAddress1, 0, nil)
	c.AddUser(mainRoyaltyAddress, 0, nil)
	blk := c.CreateBlockHeader(0, 1, 1)

	require.NoError(t, funTransfer(t, c, blk, sender, receiver, id, 100, 0, 1000))
	require.Equal(t, int64(300), funBalance(c, splitAddress1, kdautils.KLVIdentifier))
	require.Equal(t, int64(700), funBalance(c, mainRoyaltyAddress, kdautils.KLVIdentifier))
	require.Equal(t, int64(999_000), funBalance(c, sender, kdautils.KLVIdentifier))
	require.Equal(t, int64(100), funBalance(c, receiver, id))
}

func funSetupMarket(t *testing.T, c *Controller, royalties *kapps.RoyaltiesData, orderPrice int64) (*block.Block, []byte) {
	t.Helper()
	c.CreateAssetWithSplitRoyalties(kapps.KDAData_NonFungible, royalties)
	c.AddUser(sender, 1_000_000_000, kdautils.KLVIdentifier)
	c.AddUser(receiver, 1_000_000_000, kdautils.KLVIdentifier)
	c.AddUser(splitAddress1, 0, nil)
	c.AddUser(mainRoyaltyAddress, 0, nil)
	c.AddUser(marketplaceReferralAddress, 0, nil)

	blk := c.CreateBlockHeader(0, 1, 1)
	c.RunMintTX(blk, sender, sender, assetWithRoyaltiesIdentifier)
	marketplaceID := c.RunCreateMarketplaceTX(blk, sender, marketplaceReferralAddress, 0)
	nftKey := []byte(string(assetWithRoyaltiesIdentifier) + kapps.Sp + "1")
	orderID := c.RunSellOrderTX(blk, sender, 0, marketplaceID, nftKey, kdautils.KLVIdentifier, orderPrice, orderPrice/2, time.Now().AddDate(0, 0, 1).Unix())
	return blk, orderID
}

func funBuyMarket(t *testing.T, c *Controller, blk *block.Block, orderID []byte, amount int64) error {
	t.Helper()
	contract := &transaction.BuyContract{
		BuyType:    transaction.BuyContract_MarketBuy,
		ID:         orderID,
		CurrencyID: kdautils.KLVIdentifier,
		Amount:     amount,
	}
	_, err := funSend(t, c, contract, transaction.TXContract_BuyContractType, receiver, blk)
	return err
}

// A marketplace purchase whose split stays inside the royalty must settle exactly.
func TestFunc_MarketBuy_SplitWithinPoolSettles(t *testing.T) {
	royalties := &kapps.RoyaltiesData{
		Address:          mainRoyaltyAddress,
		MarketPercentage: 100,
		SplitRoyalties: map[string]*kapps.RoyaltySplitData{
			hex.EncodeToString(splitAddress1): {PercentMarketPercentage: 3000},
		},
	}
	c := NewController(t)
	blk, orderID := funSetupMarket(t, c, royalties, 1_200_000)

	require.NoError(t, funBuyMarket(t, c, blk, orderID, 1_200_000))
	require.Equal(t, int64(3_600), funBalance(c, splitAddress1, kdautils.KLVIdentifier))
	require.Equal(t, int64(8_400), funBalance(c, mainRoyaltyAddress, kdautils.KLVIdentifier))
	require.Equal(t, int64(998_800_000), funBalance(c, receiver, kdautils.KLVIdentifier))
}

func funWriteITOAsset(t *testing.T, c *Controller, royalties *kapps.RoyaltiesData) {
	t.Helper()
	asset := kapps.KDAData{
		ID:           assetITOIdentifier,
		AssetType:    kapps.KDAData_Fungible,
		Name:         []byte("FUNCTN"),
		Ticker:       assetITOIdentifier,
		OwnerAddress: sender,
		AdminAddress: admin,
		MaxSupply:    1000,
		IssueDate:    time.Now().Unix(),
		Properties:   &kapps.PropertiesData{CanMint: true, CanFreeze: true, CanBurn: true},
		Attributes:   &kapps.AttributesData{},
		Roles:        []*kapps.RolesData{{Address: sender, HasRoleMint: true}},
		Royalties:    royalties,
	}
	data, err := marshalizer.Marshal(&asset)
	require.NoError(t, err)
	require.NoError(t, c.kdaKapp.DataTrieTracker().SaveKeyValue(kdautils.ToKDAKey(assetITOIdentifier, nil), data))
	require.NoError(t, c.kappDB.SaveAccount(c.kdaKapp))
}

func funSetupITO(t *testing.T, c *Controller, royalties *kapps.RoyaltiesData) {
	t.Helper()
	c.AddUser(sender, 10_000_000, kdautils.KLVIdentifier)
	c.AddUser(receiver, 10_000_000, kdautils.KLVIdentifier)
	c.AddUser(splitAddress1, 0, nil)
	funWriteITOAsset(t, c, royalties)
	c.RunConfigITOTX(createBlockHeader(), sender, sender, assetITOIdentifier, 1000, 10)

	contract := &transaction.ITOTriggerContract{
		TriggerType: transaction.ITOTriggerContract_SetITOPrices,
		AssetID:     assetITOIdentifier,
		PackInfo:    map[string]*transaction.PackInfo{"KLV": {Packs: []*transaction.PackItem{{Amount: 1, Price: 10}}}},
	}
	_, err := funSend(t, c, contract, transaction.TXContract_ITOTriggerContractType, sender, createBlockHeader())
	require.NoError(t, err)
}

func funBuyITO(t *testing.T, c *Controller) error {
	t.Helper()
	contract := &transaction.BuyContract{
		BuyType:        transaction.BuyContract_ITOBuy,
		ID:             assetITOIdentifier,
		CurrencyID:     kdautils.KLVIdentifier,
		Amount:         1,
		CurrencyAmount: 10,
	}
	blk := c.CreateBlockHeader(time.Now().AddDate(0, 0, 2).Unix(), 2, 2)
	_, err := funSend(t, c, contract, transaction.TXContract_BuyContractType, receiver, blk)
	return err
}

// A token-offering purchase whose percentage split stays inside the royalty must settle.
func TestFunc_ITOBuy_PercentSplitWithinPoolSettles(t *testing.T) {
	royalties := &kapps.RoyaltiesData{
		Address:       sender,
		ITOPercentage: 5000,
		SplitRoyalties: map[string]*kapps.RoyaltySplitData{
			hex.EncodeToString(splitAddress1): {PercentITOPercentage: 3000},
		},
	}
	c := NewController(t)
	funSetupITO(t, c, royalties)

	require.NoError(t, funBuyITO(t, c))
	require.Equal(t, int64(1), funBalance(c, splitAddress1, kdautils.KLVIdentifier))
	require.Equal(t, int64(10_000_009), funBalance(c, sender, kdautils.KLVIdentifier))
	require.Equal(t, int64(9_999_990), funBalance(c, receiver, kdautils.KLVIdentifier))
	require.Equal(t, int64(1), funBalance(c, receiver, assetITOIdentifier))
}

// A token-offering purchase whose fixed split stays inside the fixed royalty must settle.
func TestFunc_ITOBuy_FixedSplitWithinPoolSettles(t *testing.T) {
	royalties := &kapps.RoyaltiesData{
		Address:  sender,
		ITOFixed: 100,
		SplitRoyalties: map[string]*kapps.RoyaltySplitData{
			hex.EncodeToString(splitAddress1): {PercentITOFixed: 3000},
		},
	}
	c := NewController(t)
	funSetupITO(t, c, royalties)

	require.NoError(t, funBuyITO(t, c))
	require.Equal(t, int64(30), funBalance(c, splitAddress1, kdautils.KLVIdentifier))
	require.Equal(t, int64(10_000_080), funBalance(c, sender, kdautils.KLVIdentifier))
	require.Equal(t, int64(9_999_890), funBalance(c, receiver, kdautils.KLVIdentifier))
}
