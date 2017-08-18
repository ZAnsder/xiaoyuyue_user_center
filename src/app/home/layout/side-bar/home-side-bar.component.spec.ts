import { ComponentFixture, TestBed, async } from '@angular/core/testing';

import { HomeSideBarComponent } from './home-side-bar.component';

describe('HomeSideBarComponent', () => {
  let component: HomeSideBarComponent;
  let fixture: ComponentFixture<HomeSideBarComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [HomeSideBarComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HomeSideBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
