// Meteor Components
import { _ } from 'lodash';

// App Components
import { MeteorEthereum } from '/imports/utils/meteor-ethereum';
import { Contract } from '/imports/contract/contract-interface';
import { CurrentClaim } from '/imports/utils/current-claim';
import { LocaleHelpers } from '/imports/utils/i18n-helpers';
import { Helpers } from '/imports/utils/common';
import { Notify } from '/imports/utils/notify';
import { log } from '/imports/utils/logging';

// Template Components
import './claim.modal.html';


Template.claimModal.onCreated(function Template_claimModal_onCreated() {
    const instance = this;
    instance.eth = MeteorEthereum.instance();
    instance.contract = Contract.instance();
});

Template.claimModal.helpers({

    getDayIndex() {
        const instance = Template.instance();
        if (!instance.eth.hasNetwork) { return 0; }

        // Watch for changes to Current Claim and Update Price
        CurrentClaim.changeTrigger.get();
        return CurrentClaim.day;
    },

    getCurrentPrice() {
        const instance = Template.instance();
        if (!instance.eth.hasNetwork) { return ''; }

        // Watch for changes to Current Claim and Update Price
        CurrentClaim.changeTrigger.get();

        const price = CurrentClaim.price;
        return instance.eth.web3.fromWei(price, 'ether').toString(10);
    },

    hasCurrentOwner() {
        const instance = Template.instance();
        if (!instance.eth.hasNetwork) { return ''; }

        // Watch for changes to Current Claim and Update Price
        CurrentClaim.changeTrigger.get();
        return !_.isEmpty(CurrentClaim.owner) && !Helpers.isAddressZero(CurrentClaim.owner);
    },

    getCurrentOwner() {
        const instance = Template.instance();
        if (!instance.eth.hasNetwork) { return ''; }

        // Watch for changes to Current Claim and Update Owner
        CurrentClaim.changeTrigger.get();
        return CurrentClaim.owner;
    },

    getCurrentOwnerAddress() {
        const instance = Template.instance();
        if (!instance.eth.hasNetwork) { return ''; }

        // Watch for changes to Current Claim and Update Owner
        CurrentClaim.changeTrigger.get();
        return CurrentClaim.ownerAddress;
    },

    getNextPrice() {
        const instance = Template.instance();
        if (!instance.eth.hasNetwork) { return ''; }

        // Watch for changes to Current Claim and Update Owner
        CurrentClaim.changeTrigger.get();

        return instance.eth.web3.fromWei(CurrentClaim.nextPrice, 'ether').toString(10);
    },

    getColorFromAddress() {
        const instance = Template.instance();
        if (!instance.eth.hasNetwork) { return ''; }

        // Watch for changes to Current Claim and Update Price
        CurrentClaim.changeTrigger.get();

        return Helpers.getStylesForAddress(CurrentClaim.ownerAddress);
    },

    getInfo(line) {
        const instance = Template.instance();
        if (!instance.eth.hasNetwork) { return ''; }

        // Watch for changes to Current Claim and Update Price
        CurrentClaim.changeTrigger.get();

        const unit = TAPi18n.__('generic.etherUnit');
        const price = instance.eth.web3.fromWei(CurrentClaim.price, 'ether').toString(10);
        const nextPrice = instance.eth.web3.fromWei(CurrentClaim.nextPrice, 'ether').toString(10);

        switch (line) {
            case '1':
                const month = Session.get('selectedMonth');
                const day = Session.get('selectedDay');
                const date = LocaleHelpers.formatDate('MMMM Do', month, day);
                return TAPi18n.__('modal.claim.info.line1', {date, price: `${price} ${unit}`});
            case '2':
                return TAPi18n.__('modal.claim.info.line2', {price: `${nextPrice} ${unit}`});
            default:
                return TAPi18n.__(`modal.claim.info.line${line}`);
        }
    }

});

Template.claimModal.events({

    'click [data-action="claim-day"]' : (event, instance) => {
        const tx = {
            value : CurrentClaim.price,
            from  : instance.eth.coinbase
        };
        const latestClaim = _.omit(CurrentClaim, 'changeTrigger');
        const dayIndex = CurrentClaim.day;
        const month = Session.get('selectedMonth');
        const day = Session.get('selectedDay');
        const date = LocaleHelpers.formatDate('MMMM Do', month, day);
        instance.contract.claimDay(dayIndex, tx)
            .then(hash => {
                log.log('Transaction sent;', hash);
                instance.contract.waitForReceipt(hash, function (receipt) {
                    log.log('Transaction succeeded;', receipt);
                    Session.set('latestClaim', latestClaim);
                    Notify.success(TAPi18n.__('modal.claim.claimed', {date}), TAPi18n.__('modal.claim.claimTitle'));
                });
            })
            .catch(Helpers.displayFriendlyErrorAlert);

        // Close Modal
        $('#layClaimModal').modal('hide');
    }

});

