import * as React from 'react';
import { expect } from 'chai';
import { spy } from 'sinon';
import { describeConformance, act, createRenderer, fireEvent } from 'test/utils';
import Snackbar, { snackbarClasses as classes } from '@mui/material/Snackbar';

describe('<Snackbar />', () => {
  const { clock, render: clientRender } = createRenderer({ clock: 'fake' });
  /**
   * @type  {typeof plainRender extends (...args: infer T) => any ? T : enver} args
   *
   * @remarks
   * This is for all intents and purposes the same as our client render method.
   * `plainRender` is already wrapped in act().
   * However, React has a bug that flushes effects in a portal synchronously.
   * We have to defer the effect manually like `useEffect` would so we have to flush the effect manually instead of relying on `act()`.
   * React bug: https://github.com/facebook/react/issues/20074
   */
  function render(...args) {
    const result = clientRender(...args);
    clock.tick(0);
    return result;
  }

  describeConformance(<Snackbar open message="message" />, () => ({
    classes,
    inheritComponent: 'div',
    render,
    refInstanceof: window.HTMLDivElement,
    muiName: 'MuiSnackbar',
    skip: [
      'componentProp',
      'componentsProp',
      'themeVariants',
      // react-transition-group issue
      'reactTestRenderer',
    ],
  }));

  describe('prop: onClose', () => {
    it('should be call when clicking away', () => {
      const handleClose = spy();
      render(<Snackbar open onClose={handleClose} message="message" />);

      const event = new window.Event('click', { view: window, bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);

      expect(handleClose.callCount).to.equal(1);
      expect(handleClose.args[0]).to.deep.equal([event, 'clickaway']);
    });

    it('should be called when pressing Escape', () => {
      const handleClose = spy();
      render(<Snackbar open onClose={handleClose} message="message" />);

      expect(fireEvent.keyDown(document.body, { key: 'Escape' })).to.equal(true);
      expect(handleClose.callCount).to.equal(1);
      expect(handleClose.args[0][1]).to.deep.equal('escapeKeyDown');
    });

    it('can limit which Snackbars are closed when pressing Escape', () => {
      const handleCloseA = spy((event) => event.preventDefault());
      const handleCloseB = spy();
      render(
        <React.Fragment>
          <Snackbar open onClose={handleCloseA} message="messageA" />
          <Snackbar open onClose={handleCloseB} message="messageB" />
        </React.Fragment>,
      );

      fireEvent.keyDown(document.body, { key: 'Escape' });

      expect(handleCloseA.callCount).to.equal(1);
      expect(handleCloseB.callCount).to.equal(0);
    });
  });

  describe('Consecutive messages', () => {
    it('should support synchronous onExited callback', () => {
      const messageCount = 2;

      const onClose = spy();
      const onExited = spy();
      const duration = 250;

      let setSnackbarOpen;
      function Test() {
        const [open, setOpen] = React.useState(false);
        setSnackbarOpen = setOpen;

        function handleClose() {
          setOpen(false);
          onClose();
        }

        function handleExited() {
          onExited();
          if (onExited.callCount < messageCount) {
            setOpen(true);
          }
        }

        return (
          <Snackbar
            open={open}
            onClose={handleClose}
            TransitionProps={{ onExited: handleExited }}
            message="message"
            autoHideDuration={duration}
            transitionDuration={duration / 2}
          />
        );
      }
      render(
        <Test
          onClose={onClose}
          onExited={onExited}
          message="message"
          autoHideDuration={duration}
          transitionDuration={duration / 2}
        />,
      );

      expect(onClose.callCount).to.equal(0);
      expect(onExited.callCount).to.equal(0);

      act(() => {
        setSnackbarOpen(true);
      });
      clock.tick(duration);

      expect(onClose.callCount).to.equal(1);
      expect(onExited.callCount).to.equal(0);

      clock.tick(duration / 2);

      expect(onClose.callCount).to.equal(1);
      expect(onExited.callCount).to.equal(1);

      clock.tick(duration);

      expect(onClose.callCount).to.equal(messageCount);
      expect(onExited.callCount).to.equal(1);

      clock.tick(duration / 2);

      expect(onClose.callCount).to.equal(messageCount);
      expect(onExited.callCount).to.equal(messageCount);
    });
  });

  describe('prop: autoHideDuration', () => {
    it('should call onClose when the timer is done', () => {
      const handleClose = spy();
      const autoHideDuration = 2e3;
      const { setProps } = render(
        <Snackbar
          open={false}
          onClose={handleClose}
          message="message"
          autoHideDuration={autoHideDuration}
        />,
      );

      setProps({ open: true });

      expect(handleClose.callCount).to.equal(0);

      clock.tick(autoHideDuration);

      expect(handleClose.callCount).to.equal(1);
      expect(handleClose.args[0]).to.deep.equal([null, 'timeout']);
    });

    it('calls onClose at timeout even if the prop changes', () => {
      const handleClose1 = spy();
      const handleClose2 = spy();
      const autoHideDuration = 2e3;
      const { setProps } = render(
        <Snackbar
          open={false}
          onClose={handleClose1}
          message="message"
          autoHideDuration={autoHideDuration}
        />,
      );

      setProps({ open: true });
      clock.tick(autoHideDuration / 2);
      setProps({ open: true, onClose: handleClose2 });
      clock.tick(autoHideDuration / 2);

      expect(handleClose1.callCount).to.equal(0);
      expect(handleClose2.callCount).to.equal(1);
    });

    it('should not call onClose when the autoHideDuration is reset', () => {
      const handleClose = spy();
      const autoHideDuration = 2e3;
      const { setProps } = render(
        <Snackbar
          open={false}
          onClose={handleClose}
          message="message"
          autoHideDuration={autoHideDuration}
        />,
      );

      setProps({ open: true });

      expect(handleClose.callCount).to.equal(0);

      clock.tick(autoHideDuration / 2);
      setProps({ autoHideDuration: undefined });
      clock.tick(autoHideDuration / 2);

      expect(handleClose.callCount).to.equal(0);
    });

    it('should be able to interrupt the timer', () => {
      const handleMouseEnter = spy();
      const handleMouseLeave = spy();
      const handleClose = spy();
      const autoHideDuration = 2e3;

      const { container } = render(
        <Snackbar
          open
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClose={handleClose}
          message="message"
          autoHideDuration={autoHideDuration}
        />,
      );

      expect(handleClose.callCount).to.equal(0);

      clock.tick(autoHideDuration / 2);
      fireEvent.mouseEnter(container.querySelector('div'));

      expect(handleMouseEnter.callCount).to.equal(1);

      clock.tick(autoHideDuration / 2);
      fireEvent.mouseLeave(container.querySelector('div'));

      expect(handleMouseLeave.callCount).to.equal(1);
      expect(handleClose.callCount).to.equal(0);

      clock.tick(2e3);

      expect(handleClose.callCount).to.equal(1);
      expect(handleClose.args[0]).to.deep.equal([null, 'timeout']);
    });

    it('should not call onClose if autoHideDuration is undefined', () => {
      const handleClose = spy();
      const autoHideDuration = 2e3;
      render(
        <Snackbar open onClose={handleClose} message="message" autoHideDuration={undefined} />,
      );

      expect(handleClose.callCount).to.equal(0);

      clock.tick(autoHideDuration);

      expect(handleClose.callCount).to.equal(0);
    });

    it('should not call onClose if autoHideDuration is null', () => {
      const handleClose = spy();
      const autoHideDuration = 2e3;

      render(<Snackbar open onClose={handleClose} message="message" autoHideDuration={null} />);

      expect(handleClose.callCount).to.equal(0);

      clock.tick(autoHideDuration);

      expect(handleClose.callCount).to.equal(0);
    });

    it('should not call onClose when closed', () => {
      const handleClose = spy();
      const autoHideDuration = 2e3;

      const { setProps } = render(
        <Snackbar
          open
          onClose={handleClose}
          message="message"
          autoHideDuration={autoHideDuration}
        />,
      );

      expect(handleClose.callCount).to.equal(0);

      clock.tick(autoHideDuration / 2);
      setProps({ open: false });
      clock.tick(autoHideDuration / 2);

      expect(handleClose.callCount).to.equal(0);
    });
  });

  describe('prop: resumeHideDuration', () => {
    it('should not call onClose with not timeout after user interaction', () => {
      const handleClose = spy();
      const autoHideDuration = 2e3;
      const resumeHideDuration = 3e3;

      const { container } = render(
        <Snackbar
          open
          onClose={handleClose}
          message="message"
          autoHideDuration={autoHideDuration}
          resumeHideDuration={resumeHideDuration}
        />,
      );

      expect(handleClose.callCount).to.equal(0);

      clock.tick(autoHideDuration / 2);
      fireEvent.mouseEnter(container.querySelector('div'));
      clock.tick(autoHideDuration / 2);
      fireEvent.mouseLeave(container.querySelector('div'));

      expect(handleClose.callCount).to.equal(0);

      clock.tick(2e3);

      expect(handleClose.callCount).to.equal(0);
    });

    it('should call onClose when timer done after user interaction', () => {
      const handleClose = spy();
      const autoHideDuration = 2e3;
      const resumeHideDuration = 3e3;

      const { container } = render(
        <Snackbar
          open
          onClose={handleClose}
          message="message"
          autoHideDuration={autoHideDuration}
          resumeHideDuration={resumeHideDuration}
        />,
      );

      expect(handleClose.callCount).to.equal(0);

      clock.tick(autoHideDuration / 2);
      fireEvent.mouseEnter(container.querySelector('div'));
      clock.tick(autoHideDuration / 2);
      fireEvent.mouseLeave(container.querySelector('div'));

      expect(handleClose.callCount).to.equal(0);

      clock.tick(resumeHideDuration);

      expect(handleClose.callCount).to.equal(1);
      expect(handleClose.args[0]).to.deep.equal([null, 'timeout']);
    });

    it('should call onClose immediately after user interaction when 0', () => {
      const handleClose = spy();
      const autoHideDuration = 6e3;
      const resumeHideDuration = 0;
      const { setProps, container } = render(
        <Snackbar
          open
          onClose={handleClose}
          message="message"
          autoHideDuration={autoHideDuration}
          resumeHideDuration={resumeHideDuration}
        />,
      );

      setProps({ open: true });

      expect(handleClose.callCount).to.equal(0);

      fireEvent.mouseEnter(container.querySelector('div'));
      clock.tick(100);
      fireEvent.mouseLeave(container.querySelector('div'));
      clock.tick(resumeHideDuration);

      expect(handleClose.callCount).to.equal(1);
      expect(handleClose.args[0]).to.deep.equal([null, 'timeout']);
    });
  });

  describe('prop: disableWindowBlurListener', () => {
    it('should pause auto hide when not disabled and window lost focus', () => {
      const handleClose = spy();
      const autoHideDuration = 2e3;
      render(
        <Snackbar
          open
          onClose={handleClose}
          message="message"
          autoHideDuration={autoHideDuration}
          disableWindowBlurListener={false}
        />,
      );

      act(() => {
        const bEvent = new window.Event('blur', {
          view: window,
          bubbles: false,
          cancelable: false,
        });
        window.dispatchEvent(bEvent);
      });

      expect(handleClose.callCount).to.equal(0);

      clock.tick(autoHideDuration);

      expect(handleClose.callCount).to.equal(0);

      act(() => {
        const fEvent = new window.Event('focus', {
          view: window,
          bubbles: false,
          cancelable: false,
        });
        window.dispatchEvent(fEvent);
      });

      expect(handleClose.callCount).to.equal(0);

      clock.tick(autoHideDuration);

      expect(handleClose.callCount).to.equal(1);
      expect(handleClose.args[0]).to.deep.equal([null, 'timeout']);
    });

    it('should not pause auto hide when disabled and window lost focus', () => {
      const handleClose = spy();
      const autoHideDuration = 2e3;
      render(
        <Snackbar
          open
          onClose={handleClose}
          message="message"
          autoHideDuration={autoHideDuration}
          disableWindowBlurListener
        />,
      );

      act(() => {
        const event = new window.Event('blur', { view: window, bubbles: false, cancelable: false });
        window.dispatchEvent(event);
      });

      expect(handleClose.callCount).to.equal(0);

      clock.tick(autoHideDuration);

      expect(handleClose.callCount).to.equal(1);
      expect(handleClose.args[0]).to.deep.equal([null, 'timeout']);
    });
  });

  describe('prop: open', () => {
    it('should not render anything when closed', () => {
      const { container } = render(<Snackbar open={false} message="Hello, World!" />);
      expect(container).to.have.text('');
    });

    it('should be able show it after mounted', () => {
      const { container, setProps } = render(<Snackbar open={false} message="Hello, World!" />);
      expect(container).to.have.text('');
      setProps({ open: true });
      expect(container).to.have.text('Hello, World!');
    });
  });

  describe('prop: children', () => {
    it('should render the children', () => {
      const nodeRef = React.createRef();
      const children = <div ref={nodeRef} />;
      const { container } = render(<Snackbar open>{children}</Snackbar>);
      expect(container).to.contain(nodeRef.current);
    });
  });

  describe('prop: TransitionComponent', () => {
    it('should use a Grow by default', () => {
      const childRef = React.createRef();
      render(
        <Snackbar open message="message">
          <div ref={childRef} />
        </Snackbar>,
      );
      expect(childRef.current.style.transform).to.contain('scale');
    });

    it('accepts a different component that handles the transition', () => {
      const transitionRef = React.createRef();
      const Transition = () => <div className="cloned-element-class" ref={transitionRef} />;
      const { container } = render(<Snackbar open TransitionComponent={Transition} />);
      expect(container).to.contain(transitionRef.current);
    });
  });
});
