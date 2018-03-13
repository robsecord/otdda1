// Meteor Components
import { TAPi18n } from 'meteor/tap:i18n';

// Template Components
import './account-warning.component.html';


Template.accountWarningComponent.helpers({

    getCorrectNetworkName() {
        const env = process.env.NODE_ENV;
        const msg = (env === 'development')
            ? 'component.accountWarning.wrongNetwork.messageTest'
            : 'component.accountWarning.wrongNetwork.messageMain';
        return TAPi18n.__(msg);
    }

});
