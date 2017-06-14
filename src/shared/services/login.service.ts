import { Injectable } from '@angular/core';
import { Router, Params } from '@angular/router';
import { TokenAuthServiceProxy, AuthenticateModel, AuthenticateResultModel, ExternalLoginProviderInfoModel, ExternalAuthenticateModel, ExternalAuthenticateResultModel, WebLogServiceProxy } from '@shared/service-proxies/service-proxies';
import { UrlHelper } from '@shared/helpers/UrlHelper';
import { AppConsts } from '@shared/AppConsts';

import { MessageService } from '@abp/message/message.service';
import { LogService } from '@abp/log/log.service';
import { TokenService } from '@abp/auth/token.service';
import { UtilsService } from '@abp/utils/utils.service';

import { Http, Headers, Response } from '@angular/http';

import * as _ from 'lodash';
declare const FB: any; //Facebook API
declare const gapi: any; //Facebook API
declare const WL: any; //Microsoft API

export class ExternalLoginProvider extends ExternalLoginProviderInfoModel {

    static readonly FACEBOOK: string = 'Facebook';
    static readonly GOOGLE: string = 'Google';
    static readonly MICROSOFT: string = 'Microsoft';
    static readonly WECHAT: string = 'WeChat';

    icon: string;
    initialized = false;

    constructor(providerInfo: ExternalLoginProviderInfoModel) {
        super();

        this.name = providerInfo.name;
        this.clientId = providerInfo.clientId;
        this.icon = ExternalLoginProvider.getSocialIcon(this.name);
        this.initialized = providerInfo.name == 'WeChat';
    }

    private static getSocialIcon(providerName: string): string {
        providerName = providerName.toLowerCase();

        if (providerName === 'google') {
            providerName = 'googleplus';
        }

        return providerName;
    }
}

@Injectable()
export class LoginService {
    throwException: any;
    jsonParseReviver: any;

    static readonly twoFactorRememberClientTokenName = 'TwoFactorRememberClientToken';

    authenticateModel: AuthenticateModel;
    authenticateResult: AuthenticateResultModel;

    externalLoginProviders: ExternalLoginProvider[] = [];

    rememberMe: boolean;

    constructor(
        private _tokenAuthService: TokenAuthServiceProxy,
        private _router: Router,
        private _utilsService: UtilsService,
        private _messageService: MessageService,
        private _tokenService: TokenService,
        private _logService: LogService
    ) {
        this.clear();
    }

    authenticate(finallyCallback?: () => void, redirectUrl?: string): void {
        finallyCallback = finallyCallback || (() => { });

        //We may switch to localStorage instead of cookies
        this.authenticateModel.twoFactorRememberClientToken = this._utilsService.getCookieValue(LoginService.twoFactorRememberClientTokenName);

        this._tokenAuthService
            .authenticate(this.authenticateModel)
            .finally(finallyCallback)
            .subscribe((result: AuthenticateResultModel) => {
                this.processAuthenticateResult(result, redirectUrl);
            });
    }

    externalAuthenticate(provider: ExternalLoginProvider): void {
        this.ensureExternalLoginProviderInitialized(provider, () => {
            if (provider.name === ExternalLoginProvider.FACEBOOK) {
                FB.login();
            } else if (provider.name === ExternalLoginProvider.GOOGLE) {
                gapi.auth2.getAuthInstance().signIn();
            } else if (provider.name === ExternalLoginProvider.MICROSOFT) {
                WL.login({
                    scope: ["wl.signin", "wl.basic", "wl.emails"]
                });
            } else if (provider.name === ExternalLoginProvider.WECHAT) {
                jQuery.getScript('http://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js', () => {
                    var wxLogin = new WxLogin({
                        id: "external_login_container",
                        appid: provider.clientId,
                        scope: "snsapi_login",
                        redirect_uri: AppConsts.appBaseUrl + AppConsts.externalLoginUrl + '?providerName=' + ExternalLoginProvider.WECHAT,/*暂用测试域名*/
                        state: "xiaoyuyue",
                        style: "black",
                        href: "https://static.vapps.com.cn/vappszero/wechat-login.css"
                    });
                });
            }
        });
    }

    init(): void {
        this.initExternalLoginProviders();
    }

    private processAuthenticateResult(authenticateResult: AuthenticateResultModel, redirectUrl?: string) {
        this.authenticateResult = authenticateResult;

        if (authenticateResult.shouldResetPassword) {
            //Password reset

            this._router.navigate(['account/reset-password'], {
                queryParams: {
                    userId: authenticateResult.userId,
                    tenantId: abp.session.tenantId,
                    resetCode: authenticateResult.passwordResetCode
                }
            });

            this.clear();

        } else if (authenticateResult.requiresTwoFactorVerification) {
            //Two factor authentication

            this._router.navigate(['account/send-code']);

        } else if (authenticateResult.accessToken) {
            //Successfully logged in

            this.login(authenticateResult.accessToken, authenticateResult.encryptedAccessToken, authenticateResult.expireInSeconds, this.rememberMe, authenticateResult.twoFactorRememberClientToken, redirectUrl);

        } else {
            //Unexpected result!

            this._logService.warn('Unexpected authenticateResult!');
            this._router.navigate(['account/login']);

        }
    }

    private login(accessToken: string, encryptedAccessToken: string, expireInSeconds: number, rememberMe?: boolean, twoFactorRememberClientToken?: string, redirectUrl?: string): void {

        var tokenExpireDate = rememberMe ? (new Date(new Date().getTime() + 1000 * expireInSeconds)) : undefined;

        this._tokenService.setToken(
            accessToken,
            tokenExpireDate
        );

        this._utilsService.setCookieValue(
            AppConsts.authorization.encrptedAuthTokenName,
            encryptedAccessToken,
            tokenExpireDate,
            abp.appPath
        );

        if (twoFactorRememberClientToken) {
            this._utilsService.setCookieValue(
                LoginService.twoFactorRememberClientTokenName,
                twoFactorRememberClientToken,
                new Date(new Date().getTime() + 365 * 86400000), //1 year
                abp.appPath
            );
        }

        var initialUrl = UrlHelper.initialUrl;

        if (initialUrl.indexOf('/login') > 0) {
            initialUrl = AppConsts.appBaseUrl;
            // initialUrl = "http://www.vapps.com.cn";
        }

        if (redirectUrl) {
            location.href = redirectUrl;
        } else {
            location.href = initialUrl;
        }
    }

    private clear(): void {
        this.authenticateModel = new AuthenticateModel();
        this.authenticateModel.rememberClient = false;
        this.authenticateResult = null;
        this.rememberMe = false;
    }

    private initExternalLoginProviders() {
        this._tokenAuthService
            .getExternalAuthenticationProviders()
            .subscribe((providers: ExternalLoginProviderInfoModel[]) => {
                this.externalLoginProviders = _.map(providers, p => {
                    console.log(p);
                    return new ExternalLoginProvider(p);
                });
            });
    }

    ensureExternalLoginProviderInitialized(loginProvider: ExternalLoginProvider, callback: () => void) {
        if (loginProvider.initialized) {
            callback();
            return;
        }

        if (loginProvider.name === ExternalLoginProvider.FACEBOOK) {
            jQuery.getScript('//connect.facebook.net/en_US/sdk.js', () => {
                FB.init({
                    appId: loginProvider.clientId,
                    cookie: false,
                    xfbml: true,
                    version: 'v2.5'
                });

                FB.getLoginStatus(response => {
                    this.facebookLoginStatusChangeCallback(response);
                });

                callback();
            });
        } else if (loginProvider.name === ExternalLoginProvider.GOOGLE) {
            jQuery.getScript('https://apis.google.com/js/api.js', () => {
                gapi.load('client:auth2',
                    () => {
                        gapi.client.init({
                            clientId: loginProvider.clientId,
                            scope: 'openid profile email'
                        }).then(() => {
                            gapi.auth2.getAuthInstance().isSignedIn.listen((isSignedIn) => {
                                this.googleLoginStatusChangeCallback(isSignedIn);
                            });

                            this.googleLoginStatusChangeCallback(gapi.auth2.getAuthInstance().isSignedIn.get());
                        });

                        callback();
                    });
            });
        } else if (loginProvider.name === ExternalLoginProvider.MICROSOFT) {
            jQuery.getScript('//js.live.net/v5.0/wl.js', () => {
                WL.Event.subscribe("auth.login", this.microsoftLogin);
                WL.init({
                    client_id: loginProvider.clientId,
                    scope: ["wl.signin", "wl.basic", "wl.emails"],
                    redirect_uri: AppConsts.appBaseUrl,
                    response_type: "token"
                });
            });
        } else if (loginProvider.name === ExternalLoginProvider.WECHAT) {

        }
    }

    public externalLoginCallback(params: Params): void {
        this.wechatLogin(params);
    }

    private facebookLoginStatusChangeCallback(resp) {
        if (resp.status === 'connected') {
            var model = new ExternalAuthenticateModel();
            model.authProvider = ExternalLoginProvider.FACEBOOK;
            model.providerAccessCode = resp.authResponse.accessToken;
            model.providerKey = resp.authResponse.userID;
            this._tokenAuthService.externalAuthenticate(model)
                .subscribe((result: ExternalAuthenticateResultModel) => {
                    if (result.waitingForActivation) {
                        this._messageService.info("您已成功注册,请完善基本信息!");
                        return;
                    }

                    this.login(result.accessToken, result.encryptedAccessToken, result.expireInSeconds);
                });
        }
    }

    private googleLoginStatusChangeCallback(isSignedIn) {
        if (isSignedIn) {
            var model = new ExternalAuthenticateModel();
            model.authProvider = ExternalLoginProvider.GOOGLE;
            model.providerAccessCode = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
            model.providerKey = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getId();
            this._tokenAuthService.externalAuthenticate(model)
                .subscribe((result: ExternalAuthenticateResultModel) => {
                    if (result.waitingForActivation) {
                        this._messageService.info("您已成功注册,请完善基本信息!");
                        return;
                    }

                    this.login(result.accessToken, result.encryptedAccessToken, result.expireInSeconds);
                });
        }
    }

    private wechatLogin(params: Params) {
        var model = new ExternalAuthenticateModel();
        model.authProvider = ExternalLoginProvider.WECHAT;
        model.providerAccessCode = params['code'];
        model.providerKey = params['code'];
        this.externalAuthenticateAsync(model).then((result: ExternalAuthenticateResultModel) => {
            console.log(result);
            if (result.waitingForActivation) {
                this._messageService.info("您已成功注册,请完善基本信息!");
                // this._router.navigate(['/account/supplementary-external-register', result.userId]);
                return;
            }

            this.login(result.accessToken, result.encryptedAccessToken, result.expireInSeconds);
        });
    }

    /**
    * Microsoft login is not completed yet, because of an error thrown by zone.js: https://github.com/angular/zone.js/issues/290
    */
    private microsoftLogin() {
        this._logService.debug(WL.getSession());
        var model = new ExternalAuthenticateModel();
        model.authProvider = ExternalLoginProvider.MICROSOFT;
        model.providerAccessCode = WL.getSession().access_token;
        model.providerKey = WL.getSession().id; //How to get id?
        this._tokenAuthService.externalAuthenticate(model)
            .subscribe((result: ExternalAuthenticateResultModel) => {
                if (result.waitingForActivation) {
                    this._messageService.info("您已成功注册,请完善基本信息!");
                    return;
                }

                this.login(result.accessToken, result.encryptedAccessToken, result.expireInSeconds);
            });
    }

    /**
    * @return Success
    */
    externalAuthenticateAsync(model: ExternalAuthenticateModel): JQueryPromise<ExternalAuthenticateResultModel> {
        let url_ = AppConsts.remoteServiceBaseUrl + "/api/TokenAuth/ExternalAuthenticate";
        url_ = url_.replace(/[?&]$/, "");

        const content_ = JSON.stringify(model ? model.toJS() : null);

        // let options_ = {
        //     body: content_,
        //     method: "post",
        //     headers: new Headers({
        //         "Content-Type": "application/json; charset=UTF-8",
        //         "Accept": "application/json; charset=UTF-8"
        //     })
        // };
        var defer = $.Deferred();

        return abp.ajax({
            url: url_,
            method: 'POST',
            data: content_,
            async: false,
            headers: {
                'Accept-Language': abp.utils.getCookieValue("Abp.Localization.CultureName"),
                'Abp.TenantId': abp.multiTenancy.getTenantIdCookie()
                // "Content-Type": "application/json; charset=UTF-8",
                // "Accept": "application/json; charset=UTF-8"
            }
        }).done(response => {
            return response;
        });
    }

    protected processExternalAuthenticate(response: Response): ExternalAuthenticateResultModel {
        const responseText = response.text();
        const status = response.status;

        if (status === 200) {
            let result200: ExternalAuthenticateResultModel = null;
            let resultData200 = responseText === "" ? null : JSON.parse(responseText, this.jsonParseReviver);
            result200 = resultData200 ? ExternalAuthenticateResultModel.fromJS(resultData200) : new ExternalAuthenticateResultModel();
            return result200;
        } else if (status !== 200 && status !== 204) {
            this.throwException("An unexpected server error occurred.", status, responseText);
        }
        return null;
    }


}