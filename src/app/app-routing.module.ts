import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { AppRouteGuard } from './shared/common/auth/auth-route-guard';

@NgModule({
    imports: [
        RouterModule.forChild([
            {
                path: 'manage',
                canActivate: [AppRouteGuard],
                canActivateChild: [AppRouteGuard],
                children: [
                    {
                        path: 'bookingorder',
                        loadChildren: 'app/admin/admin.module#BookingOrderModule', //Lazy load admin module
                        data: { preload: true }
                    },
                    {
                        path: 'center',
                        loadChildren: 'app/center/center.module#CenterModule',
                        data: { preload: true}
                    }
                ]
            }
        ])
    ],
    exports: [RouterModule]
})
export class AppRoutingModule { }