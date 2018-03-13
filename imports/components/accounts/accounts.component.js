// Meteor Components
import { _ } from 'lodash';

// App Components
import { MeteorEthereum } from '/imports/utils/meteor-ethereum';

// Template Component
import './accounts.component.html';


Template.accountsComponent.onCreated(function Template_accountsComponent_onCreated(){
    const instance = this;
    instance.eth = MeteorEthereum.instance();

    instance.friendlyName = new ReactiveVar('');
    instance.revealBalance = new ReactiveVar(false);

    // balance update interval
    const _watchBalance = () => {
        instance.updateBalanceTimer = Meteor.setTimeout(() => {
            if (!instance.eth.hasAccount) { return; }
            instance.eth.web3.eth.getBalance(instance.eth.coinbase, (err, result) => {
                Session.set('balance', String(result));
            });
            _watchBalance();
        }, 1000);
    };

    instance.autorun(() => {
        if (!instance.eth.hasAccount) { return; }
        _watchBalance();
    });
});

Template.accountsComponent.onDestroyed(function Template_accountsComponent_onDestroyed() {
    const instance = this;
    if (instance.updateBalanceTimer) {
        Meteor.clearInterval(instance.updateBalanceTimer);
    }
});

Template.accountsComponent.events({

    'click [data-action="toggle-balance"]' : (event, instance) => {
        instance.revealBalance.set(!instance.revealBalance.get());
    }

});

Template.accountsComponent.helpers({

    getAddress() {
        const instance = Template.instance();
        return instance.eth.coinbase;
    },

    getFriendlyName() {
        return Session.get('accountNickname');
    },

    isBalanceVisible() {
        const instance = Template.instance();
        return instance.revealBalance.get();
    },

    getBalance() {
        const instance = Template.instance();
        if (!instance.eth.hasNetwork || !instance.revealBalance.get()) { return ''; }
        return instance.eth.web3.fromWei(Session.get('balance'), 'ether').toString(10);
    }
});
