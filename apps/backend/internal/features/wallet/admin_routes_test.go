package wallet

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
)

// A-10. The read and the credit must never share a capability group.
//
// Wallet credit mints ledger money and carries its own wallet:credit grant
// precisely so the default staff seed cannot mint (PR-040c). Adding the ledger
// READ is support work and belongs on customers:read — but the cheapest way to
// wire it would have been to hang it off the credit group, which silently makes
// "can look at a wallet" and "can create money" the same grant. This pins the
// split at the routing layer, where the mistake would be invisible otherwise.
func TestAdminWalletReadAndCreditMountOnSeparateGroups(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	// Two distinct prefixes stand in for two distinct capability groups.
	read := r.Group("/readgrp")
	credit := r.Group("/creditgrp")
	RegisterAdmin(read, credit, &Handler{}, nil)

	routes := map[string]string{}
	for _, ri := range r.Routes() {
		routes[ri.Method+" "+ri.Path] = ri.Path
	}

	if _, ok := routes["GET /readgrp/users/:userID/wallet/transactions"]; !ok {
		t.Error("ledger read is not on the read group — a wallet-paid order would still have no admin trail")
	}
	if _, ok := routes["POST /creditgrp/users/:userID/wallet/credit"]; !ok {
		t.Error("credit is not on the credit group")
	}
	// The two failures that matter, spelled out.
	if _, ok := routes["GET /creditgrp/users/:userID/wallet/transactions"]; ok {
		t.Error("ledger read mounted on the CREDIT group: reading a wallet would require the grant that mints money")
	}
	if _, ok := routes["POST /readgrp/users/:userID/wallet/credit"]; ok {
		t.Error("credit mounted on the READ group: anyone who can look could mint ledger money")
	}
}

// A nil read group must not panic — Register* is called with partial wiring in
// tests and alternate entrypoints.
func TestAdminWalletToleratesNilReadGroup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	credit := r.Group("/creditgrp")

	RegisterAdmin(nil, credit, &Handler{}, nil)

	for _, ri := range r.Routes() {
		if ri.Method == http.MethodGet {
			t.Fatalf("unexpected GET route %s with a nil read group", ri.Path)
		}
	}
}
