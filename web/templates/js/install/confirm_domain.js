MP.Add(function () {
  MP.ConfirmDomain = Backbone.View.extend({
    tagName: "div",
    className: "",
    events: {
      "submit #domain-form": "handleSubmit"
    },
    initialize: function () {
      _.extend(this, MP.FormMixin);
      this.listenTo(this.model, "change", this.show);
      this.micropayContract = DomainMicropay.deployed();
      this.startWatches();
      this.render();
    },

    handleSubmit: function (evt) {
      var self = this;
      this._disableForm(evt);
      try {
        this.updateStep("Creating Contract");
        this._handleFormEvt(evt, function () {
          var opts = {from: web3.eth.coinbase, gas: 100000};
          self.micropayContract.signUp(self.model.get("domain"), self.model.get("amount"), opts)
            .then(function () { /* This triggers an event on success that we're listening for */})
            .catch(function (err) { self._showError(evt, "signup-form", err); });
        });
      } catch (err) {
        self._showError(evt, "signup-form", err);
      }
      return false;
    },
    startWatches: function () {
      var self = this;
      var clientCreations = this.micropayContract.ClientCreated({fromBlock: "latest"});
      var clientConfirmations = this.micropayContract.ClientConfirmed({fromBlock: "latest"});
      clientCreations.watch(function (err, client) {
        if (err) {
          console.log(err);
          return;
        }
        if (client.domain == this.domain) {
          self.updateStep("Verifying Domain");
          clientCreations.stopWatching();
        }
      });

      clientConfirmations.watch(function (err, conf) {
        if (err) {
          console.log(err);
          return;
        }
        if (conf.domain == this.model.get("domain")) {
          self.renderSuccess(conf);
          self.clientConfirmations.stopWatching();
        }
      });
    },
    updateStep: function (step) {
      this.$el.find(".contract-step").text(step);
    },
    show: function () {
      var self = this;
      this.$el.show();
      var getBlockNumber = Promise.promisify(web3.eth.getBlockNumber, {context: web3.eth});
      var getBlock = Promise.promisify(web3.eth.getBlock, {context: web3.eth});
      return getBlockNumber()
        .then(function (num) {
          return getBlock(num - 1)
            .then(function (block) {
              self.$el
                .find(".dns-entry")
                .text("TXT    tinypay-site-verification=" + block.hash);
            });
        }).catch(function (err) {console.log(err);});
    },
    successTemplate: "<p>Your contract has been created and is available at this address. " +
    "Save it somewhere safe, you'll need it to withdraw your funds.</p>" +
    "<code><%= contractAddr %></code>",
    renderSuccess: function (contractAddr) {
      this.$el.find("#domain-form").hide();
      this.$el.find("#confirm-success").html(_.template(this.successTemplate, {contractAddr: contractAddr})).show();
      $("#step-confirm-domain").find(".step-indicator").html("<i class=\"large material-icons\">done</i>");
    }
  });
});
