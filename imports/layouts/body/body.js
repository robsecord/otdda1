// Meteor Components
import { FlowRouter } from 'meteor/kadira:flow-router';
import { TAPi18n } from 'meteor/tap:i18n';
import { Random } from 'meteor/random';
import { _ } from 'lodash';

// App Components
import { MeteorEthereum } from '/imports/utils/meteor-ethereum';
import { Contract } from '/imports/contract/contract-interface';
import { LocaleHelpers } from '/imports/utils/i18n-helpers';
import { Helpers } from '/imports/utils/common';
import { log } from '/imports/utils/logging';

// Globals
import {
    ACCOUNT_WATCH_INTERVAL
} from '/imports/utils/global-constants';

// Template Components
import '/imports/modals/error/error.modal';
import '/imports/modals/nickname/nickname.modal';
import '/imports/modals/claim/claim.modal';
import './body.html';


Template.bodyLayout.onCreated(function Template_bodyLayout_onCreated() {
    const instance = this;
    instance.eth = MeteorEthereum.instance();
    instance.contract = Contract.instance();

    Session.setDefaultPersistent('selectedMonth', 0);
    Session.setDefaultPersistent('selectedDay', 1);
    Session.setDefault('accountNickname', '');
    Session.setDefault('latestClaim', {});

    let lastKnownCoinbase = '';
    instance.autorun(computation => {
        if (!instance.eth.hasNetwork) { return; }
        computation.stop();

        // Let's watch the Coinbase Account of the User
        instance.accountWatchTimer = Meteor.setInterval(function () {
            const coinbase = instance.eth.web3.eth.coinbase;

            // Check if the Coinbase Account has changed
            if (lastKnownCoinbase === coinbase) { return; }
            lastKnownCoinbase = coinbase;

            // Reactively update the Coinbase Account
            instance.eth.coinbase = coinbase;
            instance.eth.hasAccount = !_.isEmpty(coinbase);

            // Get Account Nickname (if any)
            _getAccountNickname(instance);
        }, ACCOUNT_WATCH_INTERVAL);
    });
});

Template.bodyLayout.onRendered(function Template_bodyLayout_onRendered() {
    // Set Page Desc
    Meta.set('description', TAPi18n.__('page.desc'));

    Meteor.defer(() => {
        $('.dropdown-toggle').dropdown();
        $('[data-toggle="tooltip"]').tooltip();
    });

    if (/development/i.test(process.env.NODE_ENV)) {
        for (let i = 0; i < 366; i++) {
            const {month, day} = Helpers.getMonthDayFromIndex(i);
            console.log(i, ' = ', month + 1, day);
        }
    }
});

Template.bodyLayout.onDestroyed(function Template_bodyLayout_onDestroyed() {
    const instance = this;
    if (instance.accountWatchTimer) {
        Meteor.clearInterval(instance.accountWatchTimer);
    }
});

Template.bodyLayout.helpers({

    getAccountAddress() {
        const instance = Template.instance();
        if (!instance.eth.hasAccount) { return ''; }
        return instance.eth.coinbase;
    },

    getCalendarRoute() {
        return FlowRouter.path('calendar');
    },

    getAccountRoute() {
        return FlowRouter.path('account');
    },

    getActiveClass(route) {
        return (_.endsWith(FlowRouter.getRouteName(), route)) ? 'active' : '';
    },

    getAccountNickname() {
        const instance = Template.instance();
        if (!instance.eth.hasAccount) { return ''; }
        return Session.get('accountNickname');
    },

    getColorFromAddress() {
        const instance = Template.instance();
        if (!instance.eth.hasAccount) { return ''; }
        return Helpers.getStylesForAddress(instance.eth.coinbase);
    },

    hasRecentClaim() {
        const instance = Template.instance();
        if (!instance.eth.hasAccount) { return ''; }
        return !_.isEmpty(Session.get('latestClaim'));
    }

});

Template.bodyLayout.events({

    'click .dropdown-toggle': event => { event.preventDefault(); },

    'click [href="#"]': event => { event.preventDefault(); },

    'click [data-action="change-lang"]' : event => {
        const $target = $(event.currentTarget);
        LocaleHelpers.setLanguage($target.attr('data-lang') || 'en');
    }

});


function _getAccountNickname(instance) {
    if (instance.view.isDestroyed || _.isEmpty(instance.eth.coinbase)) { return; }

    // Use Address as Nickname
    Session.set('accountNickname', Helpers.shortAddress(instance.eth.coinbase));

    // Get Nickname from Contract
    Helpers.getFriendlyOwnerName(instance.contract, instance.eth.coinbase)
        .then(name => Session.set('accountNickname', name))
        .catch(log.error);
}
