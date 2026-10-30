package transaction_test

// Behavioural security checks for royalty split settlement. Every test drives the
// real transaction processor (ProcessTransaction) with the project's own in-memory
// account fixtures; the split configuration is written as stored asset state, as it
// would have been saved by an earlier transaction.

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

const secWrapped = uint32(0xFFFFFFFF - 20000 + 1) // 20000 + secWrapped wraps uint32 to 0

func secWriteAsset(t *testing.T, c *Controller, id []byte, assetType kapps.KDAData_EnumAssetType, royalties *kapps.RoyaltiesData) {
	t.Helper()
	asset := kapps.KDAData{
		ID:           id,
		AssetType:    assetType,
		Name:         []byte("SECRTY"),
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

func secWriteITOAsset(t *testing.T, c *Controller, royalties *kapps.RoyaltiesData) {
	t.Helper()
	asset := kapps.KDAData{
		ID:           assetITOIdentifier,
		AssetType:    kapps.KDAData_Fungible,
		Name:         []byte("SECRTY"),
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

func secSend(t *testing.T, c *Controller, contract proto.Message, contractType transaction.TXContract_ContractType, signer []byte, blk *block.Block) (*transaction.Transaction, error) {
	t.Helper()
	tx, err := createTransactionMock(contract, contractType, signer, 0)
	require.NoError(t, err)
	_, hash, err := c.execTx.PreProcessTransaction(tx)
	require.NoError(t, err)
	return tx, c.execTx.ProcessTransaction(blk, hash, tx)
}

func secTransfer(t *testing.T, c *Controller, blk *block.Block, from, to, assetID []byte, amount, kdaRoyalties, klvRoyalties int64) (*transaction.Transaction, error) {
	t.Helper()
	contract := &transaction.TransferContract{
		ToAddress:    to,
		AssetID:      assetID,
		Amount:       amount,
		KDARoyalties: kdaRoyalties,
		KLVRoyalties: klvRoyalties,
	}
	return secSend(t, c, contract, transaction.TXContract_TransferContractType, from, blk)
}

func secHasReceipt(tx *transaction.Transaction, rt txp.ReceiptType) bool {
	for _, r := range tx.Receipts {
		if len(r.Data) > 0 && len(r.Data[0]) > 0 && r.Data[0][0] == byte(rt) {
			return true
		}
	}
	return false
}

func secBalance(c *Controller, addr, assetID []byte) int64 {
	return loadUserAccount(c.accCacher, addr).GetBalance(assetID, true)
}

// A split share above 100% may not be accepted at asset creation, even when the
// per-field values are chosen so their wrapped sum passes the aggregate check.
func TestSec_Create_WrappedSplitSharesRefused(t *testing.T) {
	royalties := &transaction.RoyaltiesInfo{
		TransferPercentage: []*transaction.RoyaltyInfo{{Amount: 1000, Percentage: 500}},
		SplitRoyalties: map[string]*transaction.RoyaltySplitInfo{
			hex.EncodeToString(splitAddress1): {PercentTransferPercentage: 20000},
			hex.EncodeToString(splitAddress2): {PercentTransferPercentage: secWrapped},
		},
	}
	contract := &transaction.CreateAssetContract{
		Type:         transaction.CreateAssetContract_Fungible,
		Name:         []byte("SECRTY"),
		Ticker:       []byte("SECRTY"),
		OwnerAddress: sender,
		MaxSupply:    10000,
		Properties:   &transaction.PropertiesInfo{CanMint: true},
		Royalties:    royalties,
	}

	c := NewController(t)
	c.AddUser(sender, 1_000_000, kdautils.KLVIdentifier)

	tx, err := secSend(t, c, contract, transaction.TXContract_CreateAssetContractType, sender, createBlockHeader())
	require.Error(t, err, "a split share above 100% must be refused")
	require.False(t, secHasReceipt(tx, txp.CreateKDA), "a refused creation must not create the asset")
}

// The same bound must hold when the split configuration is updated on an existing asset.
func TestSec_Trigger_WrappedSplitSharesRefused(t *testing.T) {
	id := []byte("SECUPD")
	original := &kapps.RoyaltiesData{
		Address:            mainRoyaltyAddress,
		TransferPercentage: []*kapps.RoyaltyData{{Amount: 1000, Percentage: 500}},
		SplitRoyalties:     map[string]*kapps.RoyaltySplitData{},
	}
	c := NewController(t)
	secWriteAsset(t, c, id, kapps.KDAData_Fungible, original)
	c.AddUser(sender, 1_000_000, kdautils.KLVIdentifier)

	royalties := &transaction.RoyaltiesInfo{
		Address:            mainRoyaltyAddress,
		TransferPercentage: []*transaction.RoyaltyInfo{{Amount: 1000, Percentage: 500}},
		SplitRoyalties: map[string]*transaction.RoyaltySplitInfo{
			hex.EncodeToString(splitAddress1): {PercentTransferPercentage: 20000},
			hex.EncodeToString(splitAddress2): {PercentTransferPercentage: secWrapped},
		},
	}
	contract := &transaction.AssetTriggerContract{
		TriggerType: transaction.AssetTriggerContract_UpdateRoyalties,
		AssetID:     id,
		Royalties:   royalties,
	}
	tx, err := secSend(t, c, contract, transaction.TXContract_AssetTriggerContractType, sender, createBlockHeader())
	require.Error(t, err, "a split share above 100% must be refused on update")
	require.False(t, secHasReceipt(tx, txp.UpdateKDA), "a refused update must not store the configuration")
}

// A stored split share above the royalty pool may not pay out more than the pool.
func TestSec_Transfer_SplitShareAbovePoolRefused(t *testing.T) {
	id := []byte("SECTRF")
	royalties := &kapps.RoyaltiesData{
		Address:            mainRoyaltyAddress,
		TransferPercentage: []*kapps.RoyaltyData{{Amount: 1000, Percentage: 500}},
		SplitRoyalties: map[string]*kapps.RoyaltySplitData{
			hex.EncodeToString(splitAddress1): {PercentTransferPercentage: 20000},
		},
	}
	c := NewController(t)
	secWriteAsset(t, c, id, kapps.KDAData_Fungible, royalties)
	c.AddUser(sender, 1_000_000, id)
	c.AddUser(receiver, 0, nil)
	c.AddUser(splitAddress1, 0, nil)
	c.AddUser(mainRoyaltyAddress, 0, nil)
	blk := c.CreateBlockHeader(0, 1, 1)

	_, err := secTransfer(t, c, blk, sender, receiver, id, 800, 40, 0)
	require.Error(t, err, "a payout above the funded royalty must be refused")
	require.Equal(t, int64(0), secBalance(c, splitAddress1, id), "a refused payout must not credit the split recipient")
	require.Equal(t, int64(1_000_000), secBalance(c, sender, id), "a refused payout must not change the payer balance")
	require.Equal(t, int64(0), secBalance(c, receiver, id), "a refused payout must not move the transferred amount")
}

// Shares that each sit at or below 100% but add up past the royalty pool must be
// refused once the pool runs out mid-distribution.
func TestSec_Transfer_SplitSharesSumAbovePoolRefused(t *testing.T) {
	id := []byte("SECSUM")
	royalties := &kapps.RoyaltiesData{
		Address:            mainRoyaltyAddress,
		TransferPercentage: []*kapps.RoyaltyData{{Amount: 1000, Percentage: 500}},
		SplitRoyalties: map[string]*kapps.RoyaltySplitData{
			hex.EncodeToString(splitAddress1): {PercentTransferPercentage: 6000},
			hex.EncodeToString(splitAddress2): {PercentTransferPercentage: 6000},
		},
	}
	c := NewController(t)
	secWriteAsset(t, c, id, kapps.KDAData_Fungible, royalties)
	c.AddUser(sender, 1_000_000, id)
	c.AddUser(receiver, 0, nil)
	c.AddUser(splitAddress1, 0, nil)
	c.AddUser(splitAddress2, 0, nil)
	c.AddUser(mainRoyaltyAddress, 0, nil)
	blk := c.CreateBlockHeader(0, 1, 1)

	_, err := secTransfer(t, c, blk, sender, receiver, id, 800, 40, 0)
	require.Error(t, err, "shares that exceed the funded royalty must be refused")
	require.Equal(t, int64(0), secBalance(c, splitAddress1, id))
	require.Equal(t, int64(0), secBalance(c, splitAddress2, id))
	require.Equal(t, int64(1_000_000), secBalance(c, sender, id))
}

// Two recipients that each take the whole royalty cannot both be paid: the second must be
// refused rather than paid out of an exhausted pool.
func TestSec_Transfer_SplitSharesEachAtWholePoolRefused(t *testing.T) {
	id := []byte("SECEXH")
	royalties := &kapps.RoyaltiesData{
		Address:            mainRoyaltyAddress,
		TransferPercentage: []*kapps.RoyaltyData{{Amount: 1000, Percentage: 500}},
		SplitRoyalties: map[string]*kapps.RoyaltySplitData{
			hex.EncodeToString(splitAddress1): {PercentTransferPercentage: core.HundredPercent},
			hex.EncodeToString(splitAddress2): {PercentTransferPercentage: core.HundredPercent},
		},
	}
	c := NewController(t)
	secWriteAsset(t, c, id, kapps.KDAData_Fungible, royalties)
	c.AddUser(sender, 1_000_000, id)
	c.AddUser(receiver, 0, nil)
	c.AddUser(splitAddress1, 0, nil)
	c.AddUser(splitAddress2, 0, nil)
	c.AddUser(mainRoyaltyAddress, 0, nil)
	blk := c.CreateBlockHeader(0, 1, 1)

	_, err := secTransfer(t, c, blk, sender, receiver, id, 800, 40, 0)
	require.Error(t, err, "a payout from an exhausted royalty pool must be refused")
	require.Equal(t, int64(0), secBalance(c, splitAddress1, id))
	require.Equal(t, int64(0), secBalance(c, splitAddress2, id))
	require.Equal(t, int64(1_000_000), secBalance(c, sender, id))
}

// Splitting the whole royalty between recipients is legitimate, but the payer must
// still be debited exactly the royalty: credited value may never appear from nowhere.
func TestSec_Transfer_WholeRoyaltySplitConservesValue(t *testing.T) {
	id := []byte("SECALL")
	royalties := &kapps.RoyaltiesData{
		Address:            mainRoyaltyAddress,
		TransferPercentage: []*kapps.RoyaltyData{{Amount: 1000, Percentage: 500}},
		SplitRoyalties: map[string]*kapps.RoyaltySplitData{
			hex.EncodeToString(splitAddress1): {PercentTransferPercentage: core.HundredPercent},
		},
	}
	c := NewController(t)
	secWriteAsset(t, c, id, kapps.KDAData_Fungible, royalties)
	c.AddUser(sender, 1_000_000, id)
	c.AddUser(receiver, 0, nil)
	c.AddUser(splitAddress1, 0, nil)
	c.AddUser(mainRoyaltyAddress, 0, nil)
	blk := c.CreateBlockHeader(0, 1, 1)

	_, err := secTransfer(t, c, blk, sender, receiver, id, 800, 40, 0)
	require.NoError(t, err, "a whole-royalty split is legitimate and must settle")

	senderDebit := int64(1_000_000) - secBalance(c, sender, id)
	credited := secBalance(c, receiver, id) + secBalance(c, splitAddress1, id) + secBalance(c, mainRoyaltyAddress, id)
	require.Equal(t, int64(840), senderDebit, "the payer must be debited the transfer amount plus the royalty")
	require.Equal(t, senderDebit, credited, "credited value must equal the payer debit (no mint)")
	require.Equal(t, int64(40), secBalance(c, splitAddress1, id))
}

// A fixed-royalty transfer with several split recipients must not pay out more than
// the fixed royalty taken from the payer.
func TestSec_Transfer_FixedSplitSharesSumAbovePoolRefused(t *testing.T) {
	id := []byte("SECFIX")
	royalties := &kapps.RoyaltiesData{
		Address:       mainRoyaltyAddress,
		TransferFixed: 1000,
		SplitRoyalties: map[string]*kapps.RoyaltySplitData{
			hex.EncodeToString(splitAddress1): {PercentTransferFixed: 6000},
			hex.EncodeToString(splitAddress2): {PercentTransferFixed: 6000},
		},
	}
	c := NewController(t)
	secWriteAsset(t, c, id, kapps.KDAData_Fungible, royalties)
	c.AddUser(sender, 1_000_000, kdautils.KLVIdentifier)
	c.AddUser(sender, 1_000_000, id)
	c.AddUser(receiver, 0, id)
	c.AddUser(splitAddress1, 0, nil)
	c.AddUser(splitAddress2, 0, nil)
	c.AddUser(mainRoyaltyAddress, 0, nil)
	blk := c.CreateBlockHeader(0, 1, 1)

	_, err := secTransfer(t, c, blk, sender, receiver, id, 100, 0, 1000)
	require.Error(t, err, "fixed-royalty shares that exceed the fixed royalty must be refused")
	require.Equal(t, int64(0), secBalance(c, splitAddress1, kdautils.KLVIdentifier))
	require.Equal(t, int64(0), secBalance(c, splitAddress2, kdautils.KLVIdentifier))
	require.Equal(t, int64(1_000_000), secBalance(c, sender, kdautils.KLVIdentifier))
}

func secSellAndBuy(t *testing.T, c *Controller, royalties *kapps.RoyaltiesData, orderPrice int64) (*block.Block, error) {
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

	contract := &transaction.BuyContract{
		BuyType:    transaction.BuyContract_MarketBuy,
		ID:         orderID,
		CurrencyID: kdautils.KLVIdentifier,
		Amount:     orderPrice,
	}
	_, err := secSend(t, c, contract, transaction.TXContract_BuyContractType, receiver, blk)
	return blk, err
}

// A marketplace purchase settles the same stored split configuration and must enforce
// the same bound.
func TestSec_MarketBuy_SplitShareAbovePoolRefused(t *testing.T) {
	royalties := &kapps.RoyaltiesData{
		Address:          mainRoyaltyAddress,
		MarketPercentage: 100,
		SplitRoyalties: map[string]*kapps.RoyaltySplitData{
			hex.EncodeToString(splitAddress1): {PercentMarketPercentage: 0x80000000},
		},
	}
	c := NewController(t)
	_, err := secSellAndBuy(t, c, royalties, 1_200_000)
	require.Error(t, err, "a marketplace payout above the funded royalty must be refused")
	require.Equal(t, int64(0), secBalance(c, splitAddress1, kdautils.KLVIdentifier), "a refused payout must not credit the split recipient")
	require.Equal(t, int64(1_000_000_000), secBalance(c, receiver, kdautils.KLVIdentifier), "a refused purchase must not debit the buyer")
	require.Equal(t, int64(1_000_000_000), secBalance(c, sender, kdautils.KLVIdentifier), "a refused purchase must not pay the seller")
}

func secSetupITO(t *testing.T, c *Controller, royalties *kapps.RoyaltiesData) {
	t.Helper()
	c.AddUser(sender, 10_000_000, kdautils.KLVIdentifier)
	c.AddUser(receiver, 10_000_000, kdautils.KLVIdentifier)
	c.AddUser(splitAddress1, 0, nil)
	secWriteITOAsset(t, c, royalties)
	c.RunConfigITOTX(createBlockHeader(), sender, sender, assetITOIdentifier, 1000, 10)

	contract := &transaction.ITOTriggerContract{
		TriggerType: transaction.ITOTriggerContract_SetITOPrices,
		AssetID:     assetITOIdentifier,
		PackInfo:    map[string]*transaction.PackInfo{"KLV": {Packs: []*transaction.PackItem{{Amount: 1, Price: 10}}}},
	}
	_, err := secSend(t, c, contract, transaction.TXContract_ITOTriggerContractType, sender, createBlockHeader())
	require.NoError(t, err)
}

func secBuyITO(t *testing.T, c *Controller) error {
	t.Helper()
	contract := &transaction.BuyContract{
		BuyType:        transaction.BuyContract_ITOBuy,
		ID:             assetITOIdentifier,
		CurrencyID:     kdautils.KLVIdentifier,
		Amount:         1,
		CurrencyAmount: 10,
	}
	blk := c.CreateBlockHeader(time.Now().AddDate(0, 0, 2).Unix(), 2, 2)
	_, err := secSend(t, c, contract, transaction.TXContract_BuyContractType, receiver, blk)
	return err
}

// A token-offering purchase settles the same stored split configuration and must
// enforce the same bound.
func TestSec_ITOBuy_PercentSplitShareAbovePoolRefused(t *testing.T) {
	royalties := &kapps.RoyaltiesData{
		Address:       sender,
		ITOPercentage: 5000,
		SplitRoyalties: map[string]*kapps.RoyaltySplitData{
			hex.EncodeToString(splitAddress1): {PercentITOPercentage: 0x80000000},
		},
	}
	c := NewController(t)
	secSetupITO(t, c, royalties)

	err := secBuyITO(t, c)
	require.Error(t, err, "a token-offering payout above the funded royalty must be refused")
	require.Equal(t, int64(0), secBalance(c, splitAddress1, kdautils.KLVIdentifier), "a refused payout must not credit the split recipient")
	require.Equal(t, int64(10_000_000), secBalance(c, receiver, kdautils.KLVIdentifier), "a refused purchase must not debit the buyer")
}

// The fixed token-offering royalty is split through the same configuration and must
// enforce the same bound.
func TestSec_ITOBuy_FixedSplitShareAbovePoolRefused(t *testing.T) {
	royalties := &kapps.RoyaltiesData{
		Address:  sender,
		ITOFixed: 100,
		SplitRoyalties: map[string]*kapps.RoyaltySplitData{
			hex.EncodeToString(splitAddress1): {PercentITOFixed: 0x80000000},
		},
	}
	c := NewController(t)
	secSetupITO(t, c, royalties)

	err := secBuyITO(t, c)
	require.Error(t, err, "a fixed token-offering payout above the funded royalty must be refused")
	require.Equal(t, int64(0), secBalance(c, splitAddress1, kdautils.KLVIdentifier), "a refused payout must not credit the split recipient")
	require.Equal(t, int64(10_000_000), secBalance(c, receiver, kdautils.KLVIdentifier), "a refused purchase must not debit the buyer")
}
