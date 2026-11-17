#!/bin/bash
# Fresh demo repositories for the walkthroughs. Usage: setup.sh <home>. Deletes <home> first.
set -e
[ -n "$1" ] || { echo "usage: setup.sh <home>" >&2; exit 2; }
# Only ever delete a folder this script made.
if [ -e "$1" ] && [ ! -e "$1/.gm-walkthrough-home" ]; then echo "$1 exists and is not a demo home" >&2; exit 1; fi
export HOME=$1; rm -rf "$HOME"; mkdir -p "$HOME/src"; touch "$HOME/.gm-walkthrough-home"
git config --global user.name "Ana Souza"; git config --global user.email ana@example.com
git config --global init.defaultBranch main; git config --global advice.detachedHead false
mk() { d=$HOME/src/$1; mkdir -p $d; cd $d; git init -q; }
# ledger (rust)
mk ledger; mkdir src
cat > Cargo.toml <<'X'
[package]
name = "ledger"
version = "0.4.0"
edition = "2024"
X
cat > src/ledger.rs <<'X'
use std::collections::HashMap;

use crate::entry::{Balance, Entry};

pub struct Ledger {
    accounts: HashMap<u64, Account>,
}

impl Ledger {
    pub fn new() -> Self {
        Self { accounts: HashMap::new() }
    }

    pub fn open(&mut self, id: u64) {
        self.accounts.entry(id).or_default();
    }

    pub fn balance(&self, id: u64) -> Option<Balance> {
        self.accounts.get(&id).map(Account::balance)
    }
}
X
cat > src/fees.rs <<'X'
pub struct Fees {
    rate_bps: i64,
}

impl Fees {
    pub fn fee(&self, amount: i64) -> i64 {
        amount * 3 / 100
    }
}
X
git add -A; git commit -qm "Ledger with accounts and balances"
# checkout-api
mk checkout-api; mkdir src
printf '[package]\nname = "checkout-api"\nversion = "1.8.2"\nedition = "2024"\n' > Cargo.toml
printf 'pub fn route() -> &%s str {\n    "/v1/checkout"\n}\n' "'static" > src/routes.rs
git add -A; git commit -qm "Checkout routes"
# payments
mk payments; mkdir src
printf '[package]\nname = "payments"\nversion = "2.3.0"\nedition = "2024"\n' > Cargo.toml
printf 'pub fn capture(amount: i64) -> i64 {\n    amount\n}\n' > src/capture.rs
git add -A; git commit -qm "Capture payments"
# storefront
mk storefront; mkdir src
printf '{ "name": "storefront", "version": "5.0.1" }\n' > package.json
printf 'export const checkoutUrl = "/v1/checkout";\n' > src/checkout.ts
git add -A; git commit -qm "Storefront checkout link"
git -C $HOME/src/payments branch feat/checkout-v2
